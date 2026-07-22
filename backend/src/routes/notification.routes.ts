import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { listNotifications, getUnreadCount, markRead } from '../controllers/notification.controller';

// Mounted at /api/notifications — any authenticated user reads/manages their own
const router = Router();

router.use(authenticate);

router.get('/', listNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/:id/read', markRead);

export default router;
