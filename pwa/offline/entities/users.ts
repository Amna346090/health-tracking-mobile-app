import { cache } from '../cache';
import { localDelete } from '../mutate';
import { isTempId } from '../tempId';
import type { IdLike } from '../types';
import type { ManagedUser } from '../../api/users';

export type { ManagedUser };
export { isTempId };

export interface OfflineManagedUser extends Omit<ManagedUser, 'id'> {
  id: IdLike;
  pendingSync?: boolean;
}

export async function listUsersCached(): Promise<OfflineManagedUser[]> {
  return cache.list<OfflineManagedUser>('users');
}

export async function mergeUsersFromServer(serverList: ManagedUser[]): Promise<OfflineManagedUser[]> {
  const pendingIds = new Set((await listUsersCached()).filter((u) => u.pendingSync).map((u) => String(u.id)));
  return cache.replaceFromServer<OfflineManagedUser>('users', serverList, pendingIds);
}

export async function deleteUserOffline(id: IdLike): Promise<void> {
  await localDelete('users', id, {
    method: 'DELETE',
    pathTemplate: isTempId(id) ? '/users/${userId}' : `/users/${id}`,
    refs: isTempId(id) ? { userId: String(id) } : undefined,
  });
  // If this account also shows up separately in the 'patients' cache (the Patients tab),
  // clear it there too — otherwise that list keeps showing a now-deleted patient until it
  // happens to refetch on its own.
  const patients = await cache.list<{ id: IdLike; user: { id: IdLike } }>('patients');
  const match = patients.find((p) => String(p.user.id) === String(id));
  if (match) await cache.remove('patients', match.id);
}
