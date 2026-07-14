import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { listReminderLogs } from '../controllers/reminder.controller';

const router = Router();

router.use(authenticate);

// GET /api/reminders/:patientId — paginated reminder log for a patient
router.get('/:patientId', listReminderLogs);

export default router;
