import { api } from './client';

export interface ManagedUser {
  id: number;
  email: string;
  role: 'PATIENT' | 'STAFF' | 'ADMIN';
  firstName: string;
  lastName: string;
  createdAt: string;
}

export const getAllUsers = () => api.get<ManagedUser[]>('/users');

export const deleteUser = (id: number) => api.delete<{ id: number }>(`/users/${id}`);

export const resetUserPassword = (id: number, newPassword: string) =>
  api.post<void>(`/users/${id}/reset-password`, { newPassword });
