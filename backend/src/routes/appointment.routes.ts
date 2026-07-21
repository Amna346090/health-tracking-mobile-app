import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { getAllAppointments } from '../controllers/appointment.controller';

const router = Router();

router.use(authenticate, requireRoles(Role.STAFF, Role.ADMIN));

// GET /api/appointments — CRM-wide appointments board (?status=&from=&to=)
router.get('/', getAllAppointments);

export default router;
