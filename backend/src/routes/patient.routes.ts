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
  recordRefill,
} from '../controllers/assignment.controller';
import { downloadPrescription } from '../controllers/prescription.controller';
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
  getPresignedUrl as getDocumentPresignedUrl,
  listDocuments,
  createDocument,
} from '../controllers/document.controller';
import {
  getPatientTimeline,
  getPatientSummary,
} from '../controllers/timeline.controller';
import {
  getAppointments,
  createAppointment,
  updateAppointment,
} from '../controllers/appointment.controller';
import {
  listMessages,
  sendMessage,
  markRead,
} from '../controllers/message.controller';
import {
  getTestRequests,
  createTestRequest,
  updateTestRequest,
} from '../controllers/testRequest.controller';
import { markContacted } from '../controllers/touchBase.controller';
import {
  listMetrics,
  getTrend,
  createMetric,
  deleteMetric,
} from '../controllers/healthMetric.controller';

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
router.post('/:patientId/assignments/:id/refill', requireRoles(Role.STAFF, Role.ADMIN), recordRefill);
router.get('/:patientId/assignments/:id/prescription.pdf', downloadPrescription);

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

// ─── Document sub-routes ───────────────────────────────────────────────────────
// /presign must come before /:documentId (string vs numeric)
router.post('/:patientId/documents/presign', getDocumentPresignedUrl);
router.get('/:patientId/documents', listDocuments);
router.post('/:patientId/documents', createDocument);

// ─── Timeline + Summary ───────────────────────────────────────────────────────
router.get('/:patientId/timeline', getPatientTimeline);
router.get('/:patientId/summary',  getPatientSummary);

// ─── Appointment sub-routes ────────────────────────────────────────────────────
router.get('/:patientId/appointments', getAppointments);
router.post('/:patientId/appointments', createAppointment);
router.patch('/:patientId/appointments/:id', updateAppointment);

// ─── Message sub-routes ────────────────────────────────────────────────────────
router.get('/:patientId/messages', listMessages);
router.post('/:patientId/messages', requireRoles(Role.STAFF, Role.ADMIN), sendMessage);
router.patch('/:patientId/messages/:id/read', markRead);

// ─── Test/scan request sub-routes ──────────────────────────────────────────────
router.get('/:patientId/test-requests', getTestRequests);
router.post('/:patientId/test-requests', requireRoles(Role.STAFF, Role.ADMIN), createTestRequest);
router.patch('/:patientId/test-requests/:id', updateTestRequest);

// ─── Touch-base ─────────────────────────────────────────────────────────────────
router.post('/:patientId/contact', requireRoles(Role.STAFF, Role.ADMIN), markContacted);

// ─── Health metric sub-routes ──────────────────────────────────────────────────
// /trend must come before /:id, same convention as health-logs
router.get('/:patientId/health-metrics/trend', getTrend);
router.get('/:patientId/health-metrics', listMetrics);
router.post('/:patientId/health-metrics', createMetric);
router.delete('/:patientId/health-metrics/:id', deleteMetric);

export default router;
