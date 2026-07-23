import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import {
  getAllMedications,
  getMedicationById,
  createMedication,
  updateMedication,
  deleteMedication,
} from '../controllers/medication.controller';

const router = Router();

// All medication catalog routes require staff or admin
router.use(authenticate, requireRoles(Role.STAFF, Role.ADMIN));

router.get('/', getAllMedications);
router.post('/', createMedication);
router.get('/:id', getMedicationById);
router.patch('/:id', updateMedication);
router.delete('/:id', requireRoles(Role.ADMIN), deleteMedication);

export default router;
