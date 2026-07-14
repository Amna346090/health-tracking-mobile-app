import { api } from './client';

export interface ManagedUser {
  id: number;
  email: string;
  role: 'PATIENT' | 'STAFF' | 'ADMIN';
  firstName: string;
  lastName: string;
  createdAt: string;
}

export async function getAllUsers(): Promise<ManagedUser[]> {
  return api.get<ManagedUser[]>('/users');
}

export async function deleteUser(id: number): Promise<void> {
  await api.delete<{ id: number }>(`/users/${id}`);
}

export async function resetUserPassword(id: number, newPassword: string): Promise<void> {
  await api.post<void>(`/users/${id}/reset-password`, { newPassword });
}
