import { getAll, getOne, putOne, STORE_META } from './db';

let counter = 0;

/** A locally-unique id for a record created offline, until the server assigns a real one. */
export function newTempId(prefix: string): string {
  counter += 1;
  return `tmp_${prefix}_${Date.now().toString(36)}_${counter}_${Math.random().toString(36).slice(2, 8)}`;
}

export function isTempId(id: unknown): boolean {
  return typeof id === 'string' && id.startsWith('tmp_');
}

// In-memory cache of tempId -> real id, backed by IndexedDB so it survives a reload
// while items are still mid-sync. Loaded lazily and kept warm afterward.
const memoryMap = new Map<string, IdValue>();
let loaded = false;

type IdValue = string | number;

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  loaded = true;
  const rows = await getAll<{ key: string; value: IdValue }>(STORE_META);
  for (const row of rows) {
    if (row.key.startsWith('tempid:')) memoryMap.set(row.key.slice('tempid:'.length), row.value);
  }
}

/** Warms the in-memory temp-id map from IndexedDB — call once at startup, before any sync pass. */
export async function preloadTempIdMap(): Promise<void> {
  await ensureLoaded();
}

export async function getRealId(tempId: string): Promise<IdValue | undefined> {
  await ensureLoaded();
  if (memoryMap.has(tempId)) return memoryMap.get(tempId);
  const row = await getOne<{ key: string; value: IdValue }>(STORE_META, metaKey(tempId));
  if (row) memoryMap.set(tempId, row.value);
  return row?.value;
}

export function getRealIdSync(tempId: string): IdValue | undefined {
  return memoryMap.get(tempId);
}

export async function setRealId(tempId: string, realId: IdValue): Promise<void> {
  memoryMap.set(tempId, realId);
  await putOne(STORE_META, { key: metaKey(tempId), value: realId });
}

function metaKey(tempId: string): string {
  return `tempid:${tempId}`;
}
