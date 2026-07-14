import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { listUsers, deleteUserById, resetUserPassword } from '../controllers/user.controller';

const router = Router();

router.use(authenticate, requireRoles(Role.ADMIN));

router.get('/', listUsers);
router.delete('/:id', deleteUserById);
router.post('/:id/reset-password', resetUserPassword);

export default router;
