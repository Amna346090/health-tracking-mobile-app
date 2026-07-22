import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { getAllProviders, updateProvider } from '../controllers/provider.controller';

// Mounted at /api/providers
const router = Router();

router.use(authenticate, requireRoles(Role.STAFF, Role.ADMIN));

router.get('/', getAllProviders);
router.patch('/:id', requireRoles(Role.ADMIN), updateProvider);

export default router;
