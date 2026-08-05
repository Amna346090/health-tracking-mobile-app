import { Request, Response, NextFunction } from 'express';
import * as notificationService from '../services/notification.service';
import { AppError } from '../middleware/errorHandler';

function parseId(raw: string): number {
  const id = parseInt(raw, 10);
  if (isNaN(id)) throw new AppError('Invalid ID', 400);
  return id;
}

export async function listNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const notifications = await notificationService.getNotificationsForUser(req.user!.id);
    res.json({ status: 'ok', data: notifications });
  } catch (err) { next(err); }
}

export async function getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const count = await notificationService.getUnreadCount(req.user!.id);
    res.json({ status: 'ok', data: { count } });
  } catch (err) { next(err); }
}

export async function markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseId(req.params.id);
    const notification = await notificationService.markRead(id, req.user!.id);
    res.json({ status: 'ok', data: notification });
  } catch (err) { next(err); }
}

export async function deleteNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseId(req.params.id);
    await notificationService.deleteNotification(id, req.user!.id);
    res.json({ status: 'ok', data: null });
  } catch (err) { next(err); }
}
