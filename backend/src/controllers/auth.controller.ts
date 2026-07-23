import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import { AppError } from '../middleware/errorHandler';

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, role, firstName, lastName, dateOfBirth, gender, healthIssue, phone, address } = req.body;
    const effectiveRole = role || 'PATIENT';

    if (!firstName?.trim()) {
      res.status(400).json({ status: 'error', message: 'firstName is required' });
      return;
    }
    if (effectiveRole === 'PATIENT') {
      if (!phone?.trim()) {
        res.status(400).json({ status: 'error', message: 'phone is required for patient accounts' });
        return;
      }
    } else if (!email?.trim() || !password || !lastName?.trim()) {
      res.status(400).json({
        status: 'error',
        message: 'email, password, and lastName are required for staff/admin accounts',
      });
      return;
    }

    const user = await authService.register(
      { email: email?.trim() || undefined, password, role, firstName, lastName, dateOfBirth, gender, healthIssue, phone, address },
      req.user!.role,
    );
    res.status(201).json({ status: 'ok', data: user });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      res.status(400).json({ status: 'error', message: 'identifier and password are required' });
      return;
    }
    const result = await authService.login(identifier, password);
    res.json({ status: 'ok', data: result });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ status: 'error', message: 'refreshToken is required' });
      return;
    }
    const tokens = await authService.refresh(refreshToken);
    res.json({ status: 'ok', data: tokens });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) await authService.logout(refreshToken);
    res.json({ status: 'ok', message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.getMe(req.user!.id);
    res.json({ status: 'ok', data: user });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ status: 'error', message: 'currentPassword and newPassword are required' });
      return;
    }
    await authService.changePassword(req.user!.id, currentPassword, newPassword);
    res.json({ status: 'ok', message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
}

export async function registerPushToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      throw new AppError('token is required', 400);
    }
    await authService.registerPushToken(req.user!.id, token);
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
}

export async function updateNotificationSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { notifPush, notifEmail } = req.body;
    if (notifPush === undefined && notifEmail === undefined) {
      throw new AppError('Provide at least one of notifPush or notifEmail', 400);
    }
    const updated = await authService.updateNotificationSettings(req.user!.id, {
      ...(notifPush  !== undefined && { notifPush:  Boolean(notifPush) }),
      ...(notifEmail !== undefined && { notifEmail: Boolean(notifEmail) }),
    });
    res.json({ status: 'ok', data: updated });
  } catch (err) {
    next(err);
  }
}
