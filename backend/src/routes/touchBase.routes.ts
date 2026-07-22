import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { getQueue, getSettings, updateSettings } from '../controllers/touchBase.controller';

// Mounted at /api/touch-base
const router = Router();

router.use(authenticate, requireRoles(Role.STAFF, Role.ADMIN));

router.get('/queue', getQueue);
router.get('/settings', getSettings);
router.patch('/settings', requireRoles(Role.ADMIN), updateSettings);

export default router;
