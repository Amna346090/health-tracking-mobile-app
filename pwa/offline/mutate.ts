// Shared local-first mutation primitives. Entity wrapper modules (offline/entities/*.ts)
// compose these so every screen gets the same behavior: write to the local cache and
// return immediately, queue the real request, and let it sync in the background whether
// we're online or offline right now.
import { cache } from './cache';
import { OFFLINE_SUPPORTED } from './db';
import { enqueueItem, findItemsReferencingTempId, findPendingCreate, putQueueItem, removeQueueItems } from './queue';
import { scheduleSync } from './sync';
import type { EntityName, HttpMethod, IdLike, QueueOp } from './types';

export { newTempId, isTempId } from './tempId';

interface EnqueueSpec {
  entity: EntityName;
  op: QueueOp;
  targetId: IdLike;
  createdTempId?: string;
  method: HttpMethod;
  pathTemplate: string;
  refs?: Record<string, string>;
  body?: unknown;
  clientTimestamp?: string;
}

async function enqueue(spec: EnqueueSpec): Promise<void> {
  await enqueueItem({
    entity: spec.entity,
    op: spec.op,
    targetId: String(spec.targetId),
    createdTempId: spec.createdTempId,
    method: spec.method,
    pathTemplate: spec.pathTemplate,
    refs: spec.refs ?? {},
    body: spec.body ?? null,
    clientTimestamp: spec.clientTimestamp ?? new Date().toISOString(),
  });
  scheduleSync(0);
}

/**
 * Writes an optimistic record to the local cache immediately and queues its creation.
 * `record` must already carry the temp id (as `record.id`).
 */
export async function localCreate<T extends { id: IdLike }>(
  entity: EntityName,
  record: T,
  send: { method: HttpMethod; pathTemplate: string; refs?: Record<string, string>; body: unknown; clientTimestamp?: string },
): Promise<T> {
  await cache.put(entity, record);
  if (OFFLINE_SUPPORTED) {
    await enqueue({
      entity,
      op: 'create',
      targetId: record.id,
      createdTempId: String(record.id),
      method: send.method,
      pathTemplate: send.pathTemplate,
      refs: send.refs,
      body: send.body,
      clientTimestamp: send.clientTimestamp,
    });
  }
  return record;
}

/**
 * Updates the local cache immediately. If the record's own creation is still queued
 * (it was created offline and hasn't synced), the patch is folded into that pending
 * create instead of issuing a separate update — there's no server record to PATCH yet.
 */
export async function localUpdate<T extends { id: IdLike }>(
  entity: EntityName,
  id: IdLike,
  patch: Partial<T>,
  send: { method: HttpMethod; pathTemplate: string; refs?: Record<string, string>; body: unknown; clientTimestamp?: string },
): Promise<T> {
  const updated = await cache.merge<T>(entity, id, patch);
  if (!OFFLINE_SUPPORTED) return updated;

  const pendingCreate = await findPendingCreate(entity, String(id));
  if (pendingCreate) {
    pendingCreate.body =
      pendingCreate.body && typeof pendingCreate.body === 'object'
        ? { ...(pendingCreate.body as Record<string, unknown>), ...(send.body as Record<string, unknown>) }
        : send.body;
    await putQueueItem(pendingCreate);
    scheduleSync(0);
    return updated;
  }

  await enqueue({
    entity,
    op: 'update',
    targetId: id,
    method: send.method,
    pathTemplate: send.pathTemplate,
    refs: send.refs,
    body: send.body,
    clientTimestamp: send.clientTimestamp,
  });
  return updated;
}

/**
 * Removes the local record immediately. If it was itself created offline and never
 * synced, its pending create (and anything else queued that depends on it) is cancelled
 * outright instead of sending a delete for a record the server has never heard of.
 */
export async function localDelete(
  entity: EntityName,
  id: IdLike,
  send: { method: HttpMethod; pathTemplate: string; refs?: Record<string, string>; clientTimestamp?: string },
): Promise<void> {
  const idStr = String(id);
  await cache.remove(entity, idStr);
  if (!OFFLINE_SUPPORTED) return;

  const pendingCreate = await findPendingCreate(entity, idStr);
  if (pendingCreate) {
    const dependents = await findItemsReferencingTempId(idStr);
    await removeQueueItems(dependents.map((d) => d.id));
    return;
  }

  await enqueue({
    entity,
    op: 'delete',
    targetId: id,
    method: send.method,
    pathTemplate: send.pathTemplate,
    refs: send.refs,
    clientTimestamp: send.clientTimestamp,
  });
}
