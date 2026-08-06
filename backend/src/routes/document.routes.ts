import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getDocument, updateDocument, removeDocument } from '../controllers/document.controller';

// Mounted at /api/documents — for operations on individual documents by ID
const router = Router();

router.use(authenticate);

router.get('/:id', getDocument);
// Editing (tag, or replacing the file) was staff-only back when only the CRM's tag
// editor used this — now a patient can also edit their own document, so
// assertPatientAccess (inside updateDocument) is the real gate, same as delete below.
router.patch('/:id', updateDocument);
router.delete('/:id', removeDocument);

export default router;
