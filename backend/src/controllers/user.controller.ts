import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/user.service';

export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const users = await userService.getAllUsers();
    res.json({ status: 'ok', data: users });
  } catch (err) {
    next(err);
  }
}

export async function deleteUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ status: 'error', message: 'Invalid user ID' });
      return;
    }

    await userService.deleteUser(id, req.user!.id);
    res.json({ status: 'ok', data: { id } });
  } catch (err) {
    next(err);
  }
}

export async function resetUserPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ status: 'error', message: 'Invalid user ID' });
      return;
    }
    const { newPassword } = req.body;
    if (!newPassword) {
      res.status(400).json({ status: 'error', message: 'newPassword is required' });
      return;
    }

    await userService.resetPassword(id, newPassword);
    res.json({ status: 'ok', message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
}
