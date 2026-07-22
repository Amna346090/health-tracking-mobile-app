import { Request, Response, NextFunction } from 'express';
import { TestRequestStatus, Role } from '@prisma/client';
import * as testRequestService from '../services/testRequest.service';
import { getPatientByUserId } from '../services/patient.service';
import { AppError } from '../middleware/errorHandler';

const VALID_STATUSES: TestRequestStatus[] = ['PENDING', 'SUBMITTED', 'CANCELLED'];

function parseId(raw: string): number {
  const id = parseInt(raw, 10);
  if (isNaN(id)) throw new AppError('Invalid ID', 400);
  return id;
}

/** Throws 403 if a PATIENT user is trying to access another patient's data. */
async function assertPatientAccess(req: Request, patientId: number): Promise<void> {
  if (req.user!.role !== Role.PATIENT) return;
  const own = await getPatientByUserId(req.user!.id);
  if (!own || own.id !== patientId) throw new AppError('Forbidden', 403);
}

export async function getTestRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);
    const testRequests = await testRequestService.getTestRequestsForPatient(patientId);
    res.json({ status: 'ok', data: testRequests });
  } catch (err) { next(err); }
}

export async function getAllTestRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, overdue } = req.query;
    if (status !== undefined && !VALID_STATUSES.includes(status as TestRequestStatus)) {
      res.status(400).json({
        status: 'error',
        message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
      });
      return;
    }
    const testRequests = await testRequestService.getAllTestRequests({
      status: status as TestRequestStatus | undefined,
      overdueOnly: overdue === 'true',
    });
    res.json({ status: 'ok', data: testRequests });
  } catch (err) { next(err); }
}

export async function createTestRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    const { name, instructions, dueDate } = req.body;

    if (!name?.trim() || !dueDate || isNaN(new Date(dueDate).getTime())) {
      res.status(400).json({ status: 'error', message: 'name and a valid dueDate are required' });
      return;
    }

    const testRequest = await testRequestService.createTestRequest({
      patientId,
      name: name.trim(),
      instructions: instructions ?? null,
      dueDate,
      requestedById: req.user!.id,
    });
    res.status(201).json({ status: 'ok', data: testRequest });
  } catch (err) { next(err); }
}

export async function updateTestRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseId(req.params.id);
    const existing = await testRequestService.getTestRequestById(id);
    const patientId = existing.patient.id;
    await assertPatientAccess(req, patientId);

    const { name, instructions, dueDate, status, documentId } = req.body;

    if (req.user!.role === Role.PATIENT) {
      if (existing.status !== TestRequestStatus.PENDING) {
        throw new AppError('This request can no longer be modified', 400);
      }
      if (status !== undefined && status !== TestRequestStatus.SUBMITTED) {
        throw new AppError('Forbidden', 403);
      }
      if (name !== undefined || instructions !== undefined || dueDate !== undefined) {
        throw new AppError('Forbidden', 403);
      }
      if (status === TestRequestStatus.SUBMITTED && !documentId) {
        res.status(400).json({ status: 'error', message: 'documentId is required to submit' });
        return;
      }
    }

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      res.status(400).json({
        status: 'error',
        message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
      });
      return;
    }

    if (dueDate !== undefined && isNaN(new Date(dueDate).getTime())) {
      res.status(400).json({ status: 'error', message: 'Invalid dueDate' });
      return;
    }

    const updated = await testRequestService.updateTestRequest(id, {
      name,
      instructions,
      dueDate,
      status,
      documentId,
    });
    res.json({ status: 'ok', data: updated });
  } catch (err) { next(err); }
}
