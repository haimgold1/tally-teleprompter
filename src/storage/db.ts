const DB_NAME = 'tally';
const DB_VERSION = 1;

let connection: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('scripts', { keyPath: 'id' });
      db.createObjectStore('takes', { keyPath: 'id' }).createIndex('scriptId', 'scriptId');
      db.createObjectStore('chunks', { keyPath: ['takeId', 'seq'] });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onclose = () => {
        connection = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      connection = null;
      reject(request.error);
    };
  });
  return connection;
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function completed(tx: IDBTransaction): Promise<void> {
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new DOMException('Transaction aborted', 'AbortError'));
    tx.onerror = () => reject(tx.error);
  });
  done.catch(() => undefined);
  return done;
}

/** iOS can drop the IndexedDB connection while the app is in the background. */
function isStaleConnection(error: unknown): boolean {
  const { name, message } = (error ?? {}) as { name?: string; message?: string };
  return name === 'InvalidStateError' || /connection.*lost|closing/i.test(message ?? '');
}

/** Runs `body` in a transaction, resolving only once the data is committed. */
export async function transact<T>(
  stores: string | string[],
  mode: IDBTransactionMode,
  body: (tx: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const db = await open();
    try {
      const tx = db.transaction(stores, mode);
      const done = completed(tx);
      const value = await body(tx);
      await done;
      return value;
    } catch (error) {
      if (attempt > 0 || !isStaleConnection(error)) throw error;
      connection = null;
    }
  }
}

export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
