import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import {
  getAllPatients,
  getOwnProfile,
  getPatientById,
  updatePatient,
} from '../controllers/patient.controller';
import {
  getAssignments,
  getTodaySchedule,
  createAssignment,
  updateAssignment,
  deactivateAssignment,
} from '../controllers/assignment.controller';
import {
  listLogs,
  getLog,
  createLog,
  updateLog,
  deleteLog,
  getWeightTrend,
} from '../controllers/healthLog.controller';
import {
  getPresignedUrl,
  listPhotos,
  savePhoto,
} from '../controllers/photo.controller';
import {
  getPatientTimeline,
  getPatientSummary,
} from '../controllers/timeline.controller';

const router = Router();

router.use(authenticate);

// ─── Profile routes ───────────────────────────────────────────────────────────
// /me must come before /:id to avoid being matched as an ID
router.get('/me', requireRoles(Role.PATIENT), getOwnProfile);
router.get('/', requireRoles(Role.STAFF, Role.ADMIN), getAllPatients);
router.get('/:id', getPatientById);
router.patch('/:id', updatePatient);

// ─── Assignment sub-routes ────────────────────────────────────────────────────
// /today must come before /:id on the assignment segment
router.get('/:patientId/assignments/today', getTodaySchedule);
router.get('/:patientId/assignments', getAssignments);
router.post('/:patientId/assignments', requireRoles(Role.STAFF, Role.ADMIN), createAssignment);
router.patch('/:patientId/assignments/:id', requireRoles(Role.STAFF, Role.ADMIN), updateAssignment);
router.delete('/:patientId/assignments/:id', requireRoles(Role.STAFF, Role.ADMIN), deactivateAssignment);

// ─── Health-log sub-routes ────────────────────────────────────────────────────
// /trend must come before /:logId on the health-logs segment
router.get('/:patientId/health-logs/trend', getWeightTrend);
router.get('/:patientId/health-logs', listLogs);
router.post('/:patientId/health-logs', createLog);
router.get('/:patientId/health-logs/:logId', getLog);
router.patch('/:patientId/health-logs/:logId', updateLog);
router.delete('/:patientId/health-logs/:logId', deleteLog);

// ─── Photo sub-routes ─────────────────────────────────────────────────────────
// /presign must come before /:photoId (string vs numeric)
router.post('/:patientId/photos/presign', getPresignedUrl);
router.get('/:patientId/photos', listPhotos);
router.post('/:patientId/photos', savePhoto);

// ─── Timeline + Summary ───────────────────────────────────────────────────────
router.get('/:patientId/timeline', getPatientTimeline);
router.get('/:patientId/summary',  getPatientSummary);

export default router;
