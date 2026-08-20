import { api } from './client';

export interface Notification {
  id: number;
  userId: number;
  type: string;
  title: string;
  body: string;
  patientId: number | null;
  readAt: string | null;
  createdAt: string;
}

export const getNotifications = () => api.get<Notification[]>('/notifications');

export const getUnreadCount = () => api.get<{ count: number }>('/notifications/unread-count');

export const markNotificationRead = (id: number) =>
  api.patch<Notification>(`/notifications/${id}/read`);

export const markAllNotificationsRead = () =>
  api.patch<void>('/notifications/read-all');

export const deleteNotification = (id: number) =>
  api.delete<void>(`/notifications/${id}`);

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
