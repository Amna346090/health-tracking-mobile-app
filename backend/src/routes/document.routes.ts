import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { getDocument, updateDocument, removeDocument } from '../controllers/document.controller';

// Mounted at /api/documents — for operations on individual documents by ID
const router = Router();

router.use(authenticate);

router.get('/:id', getDocument);
router.patch('/:id', requireRoles(Role.STAFF, Role.ADMIN), updateDocument);
router.delete('/:id', removeDocument);

export default router;
