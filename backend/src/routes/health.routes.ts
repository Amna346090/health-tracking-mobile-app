import { Router } from 'express';
import { getHealthCheck } from '../controllers/health.controller';

const router = Router();

router.get('/', getHealthCheck);

export default router;
