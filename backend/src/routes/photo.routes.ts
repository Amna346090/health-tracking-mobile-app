import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getPhoto, updatePhoto, removePhoto } from '../controllers/photo.controller';

// Mounted at /api/photos — for operations on individual photos by ID
const router = Router();

router.use(authenticate);

router.get('/:id', getPhoto);
router.patch('/:id', updatePhoto);
router.delete('/:id', removePhoto);

export default router;
