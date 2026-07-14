import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getLogs, createLog } from '../controllers/assignment.controller';

// Mounted at /api/assignments
const router = Router();

router.use(authenticate);

router.get('/:id/logs', getLogs);
router.post('/:id/logs', createLog);

export default router;
