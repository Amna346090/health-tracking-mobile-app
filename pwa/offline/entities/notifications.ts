// Notifications are always created server-side (never offline) — no temp ids involved here,
// which makes this simpler than the other entities. Viewing/mark-read/delete are local-first;
// receiving a brand new notification still requires being online (nothing to build around that).
import { cache } from '../cache';
import { localDelete, localUpdate } from '../mutate';
import { enqueueItem } from '../queue';
import { scheduleSync } from '../sync';
import type { Notification } from '../../api/notifications';

export type { Notification };

export async function listNotificationsCached(): Promise<Notification[]> {
  return cache.list<Notification>('notifications');
}

export async function mergeNotificationsFromServer(serverList: Notification[]): Promise<Notification[]> {
  return cache.replaceFromServer<Notification>('notifications', serverList, new Set());
}

export async function markNotificationReadOffline(id: number): Promise<Notification> {
  return localUpdate<Notification>('notifications', id, { readAt: new Date().toISOString() }, {
    method: 'PATCH',
    pathTemplate: `/notifications/${id}/read`,
    body: {},
  });
}

export async function markAllNotificationsReadOffline(ids: number[]): Promise<void> {
  const now = new Date().toISOString();
  for (const id of ids) {
    await cache.merge<Notification>('notifications', id, { readAt: now }).catch(() => {});
  }
  await enqueueItem({
    entity: 'notifications',
    op: 'update',
    targetId: 'read-all',
    method: 'PATCH',
    pathTemplate: '/notifications/read-all',
    refs: {},
    body: {},
    clientTimestamp: now,
  });
  scheduleSync(0);
}

export async function deleteNotificationOffline(id: number): Promise<void> {
  await localDelete('notifications', id, {
    method: 'DELETE',
    pathTemplate: `/notifications/${id}`,
  });
}
