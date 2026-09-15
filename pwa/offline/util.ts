/**
 * Cheap deep-equality check for the small JSON-shaped records this app deals with. Used to
 * avoid a redundant setState when a background refresh finds the exact same data that was
 * already on screen — without this, every screen visit re-renders once from cache and then
 * again from the server, which reads as an annoying flash/flicker even when nothing changed.
 *
 * Deliberately NOT a JSON.stringify comparison: two objects with identical values but keys
 * inserted in a different order (very common here — a locally-built record vs. one that just
 * came back from the server) stringify differently even though they're equal for our purposes.
 */
export function sameData<T>(a: T, b: T): boolean {
  return deepEqual(a, b);
}

/**
 * Same purpose as `sameData`, but for a list of records that have an `id` — compares them
 * as a set, ignoring order. This matters because two lists holding the exact same records
 * can legitimately come back in different order from different sources: IndexedDB returns
 * rows sorted by an internal string key ("patients:1", "patients:10", "patients:2", ...),
 * while the server returns them in normal numeric/creation order. Comparing those position
 * by position (as `sameData` does for arrays) reports "different" every single time even
 * when nothing actually changed — which is exactly what caused the patients list to
 * re-render two or three times on every visit.
 */
export function sameList<T extends { id: string | number }>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  const bById = new Map(b.map((item) => [String(item.id), item]));
  for (const item of a) {
    const match = bById.get(String(item.id));
    if (match === undefined || !deepEqual(item, match)) return false;
  }
  return true;
}

/**
 * Sorts newest-first by `createdAt`, matching how the backend orders most lists (patients,
 * assignments, notes, notifications, ...). Local storage has no inherent order of its own —
 * it comes back sorted by an internal string key, which doesn't match the server's order.
 * Without applying the same sort on both sides, the exact same data appears to reshuffle
 * itself every time a background refresh replaces what was showing.
 */
export function byCreatedDesc<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Same idea as `sameList`, for a map of id -> list of records (e.g. dose orders keyed by
 * assignment id) — compares each list as an unordered set rather than position by position. */
export function sameListMap<T extends { id: string | number }>(
  a: Record<string, T[]>,
  b: Record<string, T[]>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!(k in b) || !sameList(a[k], b[k])) return false;
  }
  return true;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== 'object') return false; // primitives already handled by a === b above

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(bObj, key)) return false;
    if (!deepEqual(aObj[key], bObj[key])) return false;
  }
  return true;
}
