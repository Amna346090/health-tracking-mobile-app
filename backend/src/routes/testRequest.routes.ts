import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { getAllTestRequests } from '../controllers/testRequest.controller';

const router = Router();

router.use(authenticate, requireRoles(Role.STAFF, Role.ADMIN));

// GET /api/test-requests — CRM-wide test/scan requests board (?status=&overdue=)
router.get('/', getAllTestRequests);

export default router;
