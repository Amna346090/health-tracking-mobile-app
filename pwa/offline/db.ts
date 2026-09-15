import { Platform } from 'react-native';

// This feature is web-only (IndexedDB doesn't exist on native, and the PWA is the only
// target that needs offline support) — every function here degrades to a harmless no-op
// off the web so the rest of the app never has to branch on Platform itself.
export const OFFLINE_SUPPORTED = Platform.OS === 'web' && typeof indexedDB !== 'undefined';

const DB_NAME = 'tandem_offline_v1';
const DB_VERSION = 1;

export const STORE_RECORDS = 'records';
export const STORE_QUEUE = 'queue';
export const STORE_META = 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_RECORDS)) {
        const store = db.createObjectStore(STORE_RECORDS, { keyPath: 'key' });
        store.createIndex('byEntity', 'entity');
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const store = db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
        store.createIndex('byStatus', 'status');
        store.createIndex('bySeq', 'seq');
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function wrapRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function wrapTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

/** Runs `fn` inside a transaction over `storeNames`, resolving with fn's return value once the tx commits. */
export async function runTx<T>(
  storeNames: string[],
  mode: IDBTransactionMode,
  fn: (tx: IDBTransaction) => T | Promise<T>,
): Promise<T> {
  if (!OFFLINE_SUPPORTED) throw new Error('IndexedDB not supported on this platform');
  const db = await openDatabase();
  const tx = db.transaction(storeNames, mode);
  const resultPromise = Promise.resolve(fn(tx));
  const [result] = await Promise.all([resultPromise, wrapTx(tx)]);
  return result;
}

export async function getAll<T>(storeName: string): Promise<T[]> {
  return runTx([storeName], 'readonly', (tx) => wrapRequest(tx.objectStore(storeName).getAll() as IDBRequest<T[]>));
}

export async function getAllFromIndex<T>(storeName: string, indexName: string, key: string): Promise<T[]> {
  return runTx([storeName], 'readonly', (tx) =>
    wrapRequest(tx.objectStore(storeName).index(indexName).getAll(key) as IDBRequest<T[]>));
}

export async function getOne<T>(storeName: string, key: string): Promise<T | undefined> {
  return runTx([storeName], 'readonly', (tx) => wrapRequest(tx.objectStore(storeName).get(key) as IDBRequest<T | undefined>));
}

export async function putOne<T>(storeName: string, value: T): Promise<void> {
  await runTx([storeName], 'readwrite', (tx) => wrapRequest(tx.objectStore(storeName).put(value)));
}

export async function putMany<T>(storeName: string, values: T[]): Promise<void> {
  await runTx([storeName], 'readwrite', (tx) => {
    const store = tx.objectStore(storeName);
    for (const v of values) store.put(v);
  });
}

export async function deleteOne(storeName: string, key: string): Promise<void> {
  await runTx([storeName], 'readwrite', (tx) => wrapRequest(tx.objectStore(storeName).delete(key)));
}

export async function deleteMany(storeName: string, keys: string[]): Promise<void> {
  await runTx([storeName], 'readwrite', (tx) => {
    const store = tx.objectStore(storeName);
    for (const k of keys) store.delete(k);
  });
}
