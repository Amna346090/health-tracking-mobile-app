import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

export async function getNotificationsForUser(userId: number, limit = 50) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
  });
}

export async function getUnreadCount(userId: number): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markRead(id: number, requestingUserId: number) {
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) throw new AppError('Notification not found', 404);
  if (notification.userId !== requestingUserId) throw new AppError('Forbidden', 403);
  if (notification.readAt) return notification;

  return prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });
}

export interface CreateNotificationInput {
  userId: number;
  type: string;
  title: string;
  body: string;
  patientId?: number | null;
}

export async function createNotification(data: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: data.userId,
      type: data.type,
      title: data.title,
      body: data.body,
      patientId: data.patientId ?? null,
    },
  });
}
