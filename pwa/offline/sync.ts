import { AppState } from 'react-native';
import { api, ApiError } from '../api/client';
import { cache } from './cache';
import { initConnectivityWatcher, isOnline, onConnectivityChange } from './connectivity';
import { OFFLINE_SUPPORTED } from './db';
import {
  getPendingQueueItems,
  markQueueItemFailed,
  onQueueChanged,
  removeQueueItem,
} from './queue';
import { getRealId, getRealIdSync, preloadTempIdMap, setRealId } from './tempId';
import type { QueueItem } from './types';

class UnresolvedDependencyError extends Error {
  constructor(public tempId: string) {
    super(`unresolved dependency: ${tempId}`);
  }
}

function resolvePath(template: string, refs: Record<string, string>): string {
  return template.replace(/\$\{(\w+)\}/g, (_, token: string) => {
    const tempId = refs[token];
    if (tempId === undefined) throw new Error(`sync: no ref supplied for path token "${token}"`);
    const real = getRealIdSync(tempId);
    if (real === undefined) throw new UnresolvedDependencyError(tempId);
    return String(real);
  });
}

function resolveBody(body: unknown): unknown {
  if (body == null || typeof body !== 'object') return body;
  if (Array.isArray(body)) return body.map(resolveBody);
  const record = body as Record<string, unknown>;
  if ('$tempRef' in record && Object.keys(record).length === 1) {
    const tempId = record.$tempRef as string;
    const real = getRealIdSync(tempId);
    if (real === undefined) throw new UnresolvedDependencyError(tempId);
    return real;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) out[k] = resolveBody(v);
  return out;
}

async function sendResolved(item: QueueItem): Promise<unknown> {
  const path = resolvePath(item.pathTemplate, item.refs);
  const body = resolveBody(item.body);
  switch (item.method) {
    case 'POST':
      return api.post(path, body);
    case 'PATCH':
      return api.patch(path, body);
    case 'PUT':
      return api.put(path, body);
    case 'DELETE':
      return api.delete(path);
  }
}

/**
 * Most create endpoints return the record itself (id + fields matching the cache shape).
 * Patient creation is the exception: `/auth/register` returns the new *user* account, with
 * the patient record nested under `patientProfile` — a different shape entirely (id, name,
 * etc. live in different places than everywhere else patients are read from). This adapts
 * that one response into the normal `{ id, ...patientFields, user: {...} }` shape the rest
 * of the app expects, so the temp id maps to the real *patient* id (not the user id).
 */
function adaptCreateResult(entity: string, serverResult: unknown): { realId: string | number; record: Record<string, unknown> } | undefined {
  if (entity === 'patients' && serverResult && typeof serverResult === 'object') {
    const user = serverResult as Record<string, unknown>;
    const profile = user.patientProfile as Record<string, unknown> | null | undefined;
    if (profile && typeof profile.id !== 'undefined') {
      return {
        realId: profile.id as string | number,
        record: {
          ...profile,
          user: {
            id: user.id, firstName: user.firstName, lastName: user.lastName,
            email: user.email, username: user.username,
          },
        },
      };
    }
    return undefined; // registered as STAFF/ADMIN with no patient profile — nothing to cache here
  }
  const realId = extractId(serverResult);
  if (realId === undefined || !serverResult || typeof serverResult !== 'object') return undefined;
  return { realId, record: { ...(serverResult as Record<string, unknown>), id: realId } };
}

async function onItemSynced(item: QueueItem, serverResult: unknown): Promise<void> {
  if (item.op === 'create' && item.createdTempId) {
    const adapted = adaptCreateResult(item.entity, serverResult);
    if (adapted) {
      await setRealId(item.createdTempId, adapted.realId);
      await cache.remove(item.entity, item.createdTempId);
      await cache.put(item.entity, { ...adapted.record, id: adapted.realId } as { id: string | number });
    }
  } else if (item.op === 'update' && serverResult && typeof serverResult === 'object') {
    const existing = await cache.get(item.entity, item.targetId);
    if (existing) await cache.merge(item.entity, item.targetId, serverResult as Record<string, unknown>);
  }
  // 'delete' — local cache row was already removed optimistically when the action was queued.
}

function extractId(result: unknown): string | number | undefined {
  if (result && typeof result === 'object' && 'id' in (result as Record<string, unknown>)) {
    return (result as { id: string | number }).id;
  }
  return undefined;
}

function isNetworkError(e: unknown): boolean {
  return !(e instanceof ApiError) && !(e instanceof UnresolvedDependencyError);
}

let processing = false;
let scheduledTimer: ReturnType<typeof setTimeout> | null = null;

/** Runs one full sweep of the pending queue, looping until a pass makes no further progress. */
export async function processQueue(): Promise<void> {
  if (!OFFLINE_SUPPORTED || processing || !isOnline()) return;
  processing = true;
  try {
    await preloadTempIdMap();
    let progressed = true;
    while (progressed) {
      progressed = false;
      const items = await getPendingQueueItems();
      for (const item of items) {
        try {
          const result = await sendResolved(item);
          await onItemSynced(item, result);
          await removeQueueItem(item.id);
          progressed = true;
        } catch (e) {
          if (e instanceof UnresolvedDependencyError) {
            continue; // its parent hasn't synced yet — retry after the rest of this pass
          }
          if (isNetworkError(e)) {
            return; // connection dropped mid-sync; stop and wait for the next trigger
          }
          await markQueueItemFailed(item.id, e instanceof Error ? e.message : String(e));
          progressed = true;
        }
      }
    }
  } finally {
    processing = false;
  }
}

/** Debounced trigger — safe to call after every enqueue without hammering the backend. */
export function scheduleSync(delayMs = 300): void {
  if (!OFFLINE_SUPPORTED) return;
  if (scheduledTimer) clearTimeout(scheduledTimer);
  scheduledTimer = setTimeout(() => {
    scheduledTimer = null;
    processQueue();
  }, delayMs);
}

let initialized = false;

/** Wires up connectivity/foreground triggers. Call once, near app startup (e.g. root layout). */
export function initSyncEngine(): void {
  if (initialized || !OFFLINE_SUPPORTED) return;
  initialized = true;
  initConnectivityWatcher();
  onConnectivityChange((online) => {
    if (online) scheduleSync(0);
  });
  onQueueChanged(() => scheduleSync());
  AppState.addEventListener('change', (state) => {
    if (state === 'active') scheduleSync(0);
  });
  // Periodic safety net — browsers' online/offline events aren't always reliable.
  setInterval(() => scheduleSync(0), 30000);
  scheduleSync(0);
}

export { getRealId };
