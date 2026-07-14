import { api } from './client';

export async function registerPushToken(token: string): Promise<void> {
  await api.put<void>('/auth/push-token', { token });
}

export async function updateNotificationSettings(settings: {
  notifPush?: boolean;
  notifEmail?: boolean;
}): Promise<void> {
  await api.patch<void>('/auth/notification-settings', settings);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.patch<void>('/auth/change-password', { currentPassword, newPassword });
}
