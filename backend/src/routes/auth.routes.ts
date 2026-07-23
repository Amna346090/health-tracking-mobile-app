import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  register,
  login,
  refresh,
  logout,
  getMe,
  changePassword,
  registerPushToken,
  updateNotificationSettings,
} from '../controllers/auth.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';

const router = Router();

// Account creation is staff-only: there is no public sign-up flow in this app.
router.post('/register', authenticate, requireRoles(Role.STAFF, Role.ADMIN), register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.patch('/change-password', authenticate, changePassword);
router.put('/push-token', authenticate, registerPushToken);
router.patch('/notification-settings', authenticate, updateNotificationSettings);

export default router;
