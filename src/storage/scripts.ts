import { newId, requestResult, transact } from './db';

export interface Script {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  /** Monotonic, so a deleted take's number is never reused. */
  takeCounter: number;
}

export async function listScripts(): Promise<Script[]> {
  const all = await transact('scripts', 'readonly', (tx) =>
    requestResult(tx.objectStore('scripts').getAll() as IDBRequest<Script[]>),
  );
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getScript(id: string): Promise<Script | undefined> {
  return transact('scripts', 'readonly', (tx) =>
    requestResult(tx.objectStore('scripts').get(id) as IDBRequest<Script | undefined>),
  );
}

export function saveScript(script: Script): Promise<void> {
  return transact('scripts', 'readwrite', async (tx) => {
    await requestResult(tx.objectStore('scripts').put(script));
  });
}

export async function createScript(title = '', body = ''): Promise<Script> {
  const now = Date.now();
  const script: Script = { id: newId(), title, body, createdAt: now, updatedAt: now, takeCounter: 0 };
  await saveScript(script);
  return script;
}

export async function duplicateScript(source: Script): Promise<Script> {
  return createScript(`${source.title || 'Untitled'} (copy)`, source.body);
}

export async function deleteScript(id: string): Promise<void> {
  await transact(['scripts', 'takes', 'chunks'], 'readwrite', async (tx) => {
    const takes = tx.objectStore('takes');
    const takeIds = (await requestResult(takes.index('scriptId').getAllKeys(id))) as string[];
    for (const takeId of takeIds) {
      takes.delete(takeId);
      tx.objectStore('chunks').delete(chunkRange(takeId));
    }
    tx.objectStore('scripts').delete(id);
  });
}

export function chunkRange(takeId: string, fromSeq = 0): IDBKeyRange {
  return IDBKeyRange.bound([takeId, fromSeq], [takeId, Number.MAX_SAFE_INTEGER]);
}
