import { api } from './client';

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.patch<void>('/auth/change-password', { currentPassword, newPassword });
}
