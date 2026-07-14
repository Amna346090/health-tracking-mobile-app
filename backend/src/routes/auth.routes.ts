import { Router } from 'express';
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
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.patch('/change-password', authenticate, changePassword);
router.put('/push-token', authenticate, registerPushToken);
router.patch('/notification-settings', authenticate, updateNotificationSettings);

export default router;
