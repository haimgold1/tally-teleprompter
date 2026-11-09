import { baseMime } from '../lib/mime';
import type { Aspect } from '../lib/pipeline';
import { newId, requestResult, transact } from './db';
import { chunkRange, type Script } from './scripts';

export interface Take {
  id: string;
  scriptId: string;
  number: number;
  createdAt: number;
  durationMs: number;
  mimeType: string;
  size: number;
  chunkCount: number;
  /** 'recording' left over at app start means the page died mid-take. */
  status: 'recording' | 'ready';
  starred: boolean;
  thumbnail?: string;
  width: number;
  height: number;
  aspect: Aspect;
}

interface ChunkRecord {
  takeId: string;
  seq: number;
  data: ArrayBuffer;
}

/** Reads this many chunks per transaction so a long take never sits in JS memory at once. */
const ASSEMBLY_BATCH = 32;

export type TakeSpec = Pick<Take, 'mimeType' | 'width' | 'height' | 'aspect'>;

export function createTake(scriptId: string, spec: TakeSpec): Promise<Take> {
  return transact(['scripts', 'takes'], 'readwrite', async (tx) => {
    const scripts = tx.objectStore('scripts');
    const script = (await requestResult(scripts.get(scriptId))) as Script | undefined;
    if (!script) throw new Error('Script not found');
    const take: Take = {
      ...spec,
      id: newId(),
      scriptId,
      number: script.takeCounter + 1,
      createdAt: Date.now(),
      durationMs: 0,
      size: 0,
      chunkCount: 0,
      status: 'recording',
      starred: false,
    };
    scripts.put({ ...script, takeCounter: take.number });
    tx.objectStore('takes').put(take);
    return take;
  });
}

export function getTake(id: string): Promise<Take | undefined> {
  return transact('takes', 'readonly', (tx) => requestResult(tx.objectStore('takes').get(id) as IDBRequest<Take | undefined>));
}

export async function listAllTakes(): Promise<Take[]> {
  return transact('takes', 'readonly', (tx) => requestResult(tx.objectStore('takes').getAll() as IDBRequest<Take[]>));
}

export async function listTakes(scriptId: string): Promise<Take[]> {
  const takes = await transact('takes', 'readonly', (tx) =>
    requestResult(tx.objectStore('takes').index('scriptId').getAll(scriptId) as IDBRequest<Take[]>),
  );
  return takes.sort((a, b) => Number(b.starred) - Number(a.starred) || b.createdAt - a.createdAt);
}

export function updateTake(id: string, patch: Partial<Take>): Promise<void> {
  return transact('takes', 'readwrite', async (tx) => {
    const store = tx.objectStore('takes');
    const take = (await requestResult(store.get(id))) as Take | undefined;
    if (take) store.put({ ...take, ...patch });
  });
}

export function deleteTake(id: string): Promise<void> {
  return transact(['takes', 'chunks'], 'readwrite', (tx) => {
    tx.objectStore('takes').delete(id);
    tx.objectStore('chunks').delete(chunkRange(id));
  });
}

/** There is one best take per script: starring one clears the others. */
export function toggleStar(take: Take): Promise<void> {
  return transact('takes', 'readwrite', async (tx) => {
    const store = tx.objectStore('takes');
    const siblings = (await requestResult(store.index('scriptId').getAll(take.scriptId))) as Take[];
    for (const sibling of siblings) {
      const starred = sibling.id === take.id ? !take.starred : false;
      if (sibling.starred !== starred) store.put({ ...sibling, starred });
    }
  });
}

/** Rebuilds the video from its chunks, compacting into intermediate Blobs as it goes. */
export async function assembleTake(take: Take): Promise<Blob> {
  const type = baseMime(take.mimeType);
  const parts: Blob[] = [];
  for (let seq = 0; ; seq += ASSEMBLY_BATCH) {
    const batch = await transact('chunks', 'readonly', (tx) =>
      requestResult(tx.objectStore('chunks').getAll(chunkRange(take.id, seq), ASSEMBLY_BATCH) as IDBRequest<ChunkRecord[]>),
    );
    if (batch.length === 0) break;
    parts.push(new Blob(batch.map((chunk) => chunk.data), { type }));
    if (batch.length < ASSEMBLY_BATCH) break;
  }
  return new Blob(parts, { type });
}

/** Finishes takes interrupted by a crash or reload. Returns how many were saved. */
export async function recoverInterruptedTakes(): Promise<number> {
  const interrupted = (await listAllTakes()).filter((take) => take.status === 'recording');
  let recovered = 0;
  for (const take of interrupted) {
    if (take.chunkCount === 0) {
      await deleteTake(take.id);
    } else {
      await updateTake(take.id, { status: 'ready' });
      recovered++;
    }
  }
  return recovered;
}

export interface StorageUsage {
  takesBytes: number;
  quota: number | null;
  available: number | null;
}

export async function storageUsage(): Promise<StorageUsage> {
  const takes = await listAllTakes();
  const takesBytes = takes.reduce((sum, take) => sum + take.size, 0);
  const estimate = await navigator.storage?.estimate?.().catch(() => null);
  const quota = estimate?.quota ?? null;
  return { takesBytes, quota, available: quota === null ? null : quota - (estimate?.usage ?? 0) };
}

/**
 * Appends chunks strictly in order. Each chunk and the take's running totals
 * commit in one transaction, so the database is always a playable prefix.
 */
export class TakeWriter {
  private queue: Promise<void> = Promise.resolve();
  private seq = 0;
  private size = 0;
  private failed = false;

  constructor(
    readonly take: Take,
    private readonly onFailure: (error: unknown) => void,
  ) {}

  get bytesWritten(): number {
    return this.size;
  }

  append(blob: Blob, elapsedMs: number): void {
    if (blob.size === 0) return;
    this.queue = this.queue.then(async () => {
      if (this.failed) return;
      try {
        // ArrayBuffer rather than Blob: WebKit can lose Blobs stored in IndexedDB.
        const data = await blob.arrayBuffer();
        const seq = this.seq;
        const size = this.size + data.byteLength;
        await transact(['chunks', 'takes'], 'readwrite', async (tx) => {
          const record: ChunkRecord = { takeId: this.take.id, seq, data };
          tx.objectStore('chunks').put(record);
          const takes = tx.objectStore('takes');
          const current = (await requestResult(takes.get(this.take.id))) as Take | undefined;
          if (current) takes.put({ ...current, size, chunkCount: seq + 1, durationMs: elapsedMs });
        });
        this.seq = seq + 1;
        this.size = size;
      } catch (error) {
        this.failed = true;
        this.onFailure(error);
      }
    });
  }

  /** Waits for queued chunks, then marks the take complete. */
  async finish(patch: Partial<Take>): Promise<void> {
    await this.queue;
    await updateTake(this.take.id, { ...patch, status: 'ready' });
  }
}
