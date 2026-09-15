import { deleteOne, getAllFromIndex, getOne, putOne, STORE_RECORDS } from './db';
import type { CachedRecord, EntityName, IdLike } from './types';
import { sameData } from './util';

function key(entity: EntityName, id: IdLike): string {
  return `${entity}:${id}`;
}

// In-memory mirror of IndexedDB, per entity, so screens can read synchronously on mount
// instead of always starting from an empty list and waiting on an async IndexedDB read.
// IndexedDB has no synchronous API on the main thread, so the very first time an entity is
// read in a session there's nothing here yet — but once it's been read or written once,
// every screen that shows that entity again (including a fresh mount from navigating back
// and forth) gets it instantly, with zero empty-then-populated flash.
const memory = new Map<EntityName, Map<string, unknown>>();

function bucket(entity: EntityName): Map<string, unknown> {
  let b = memory.get(entity);
  if (!b) { b = new Map(); memory.set(entity, b); }
  return b;
}

type Listener = () => void;
const listeners = new Map<EntityName, Set<Listener>>();

/** Fires whenever `entity`'s cached data actually changes anywhere in the app (any screen,
 * the sync engine, anything) — so a screen currently on-screen updates immediately without
 * needing to regain focus or be manually refreshed. Never fires for a write that reproduces
 * data already there — that guard is what stops "read this, notice nothing changed, refresh
 * again anyway" from turning into an infinite loop between screens that both read and write
 * the same entity. */
export function onCacheChanged(entity: EntityName, fn: Listener): () => void {
  let set = listeners.get(entity);
  if (!set) { set = new Set(); listeners.set(entity, set); }
  set.add(fn);
  return () => set!.delete(fn);
}

function notify(entity: EntityName): void {
  for (const fn of listeners.get(entity) ?? []) fn();
}

export const cache = {
  async list<T>(entity: EntityName): Promise<T[]> {
    const rows = await getAllFromIndex<CachedRecord<T>>(STORE_RECORDS, 'byEntity', entity);
    const b = bucket(entity);
    b.clear();
    for (const r of rows) b.set(r.id, r.data);
    return rows.map((r) => r.data);
  },

  /** Synchronous read from the in-memory mirror — use as a useState initializer so a screen
   * shows real data on its very first render instead of an empty list that then re-fills. */
  listSync<T>(entity: EntityName): T[] {
    return Array.from(bucket(entity).values()) as T[];
  },

  async get<T>(entity: EntityName, id: IdLike): Promise<T | undefined> {
    const row = await getOne<CachedRecord<T>>(STORE_RECORDS, key(entity, id));
    if (row) bucket(entity).set(String(id), row.data);
    return row?.data;
  },

  getSync<T>(entity: EntityName, id: IdLike): T | undefined {
    return bucket(entity).get(String(id)) as T | undefined;
  },

  /** Writes the record. Only notifies subscribers if this actually changes what was stored —
   * a write that reproduces the same data is a no-op as far as anyone watching is concerned. */
  async put<T extends { id: IdLike }>(entity: EntityName, record: T, silent = false): Promise<boolean> {
    const b = bucket(entity);
    const idStr = String(record.id);
    const changed = !sameData(b.get(idStr), record);
    await putOne<CachedRecord<T>>(STORE_RECORDS, { key: key(entity, record.id), entity, id: idStr, data: record });
    b.set(idStr, record);
    if (!silent && changed) notify(entity);
    return changed;
  },

  async putMany<T extends { id: IdLike }>(entity: EntityName, records: T[]): Promise<void> {
    let anyChanged = false;
    for (const r of records) {
      const changed = await this.put(entity, r, true);
      anyChanged = anyChanged || changed;
    }
    if (anyChanged) notify(entity);
  },

  async remove(entity: EntityName, id: IdLike, silent = false): Promise<boolean> {
    const b = bucket(entity);
    const idStr = String(id);
    const existed = b.has(idStr);
    await deleteOne(STORE_RECORDS, key(entity, idStr));
    b.delete(idStr);
    if (!silent && existed) notify(entity);
    return existed;
  },

  /** Merges `patch` into the cached record (by field, or via an updater fn) and writes it back. */
  async merge<T extends { id: IdLike }>(
    entity: EntityName,
    id: IdLike,
    patch: Partial<T> | ((prev: T) => T),
  ): Promise<T> {
    const prev = await this.get<T>(entity, id);
    if (!prev) throw new Error(`cache.merge: no cached ${entity} record for id ${id}`);
    const next = typeof patch === 'function' ? (patch as (p: T) => T)(prev) : { ...prev, ...patch };
    await this.put(entity, next);
    return next;
  },

  /**
   * Replaces the local list for `entity` with fresh server data, while preserving any
   * records still awaiting sync (their ids are in `pendingIds` — offline-created rows
   * that don't exist on the server yet and would otherwise vanish on a background refresh).
   * Notifies once, and only if something in the set actually changed (additions, removals,
   * or edited fields) — a refresh that finds exactly what was already there is silent.
   */
  async replaceFromServer<T extends { id: IdLike }>(
    entity: EntityName,
    serverRecords: T[],
    pendingIds: Set<string>,
  ): Promise<T[]> {
    const current = await this.list<T>(entity);
    const keep = current.filter((r) => pendingIds.has(String(r.id)));
    const serverIds = new Set(serverRecords.map((r) => String(r.id)));
    const stale = current.filter((r) => !pendingIds.has(String(r.id)) && !serverIds.has(String(r.id)));

    let anyChanged = false;
    for (const s of stale) {
      const removed = await this.remove(entity, s.id, true);
      anyChanged = anyChanged || removed;
    }
    const merged = [...serverRecords, ...keep];
    for (const r of merged) {
      const changed = await this.put(entity, r, true);
      anyChanged = anyChanged || changed;
    }
    if (anyChanged) notify(entity);
    return merged;
  },
};
