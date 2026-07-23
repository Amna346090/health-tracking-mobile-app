import { Request, Response, NextFunction } from 'express';
import { DoseStatus } from '@prisma/client';
import * as assignmentService from '../services/assignment.service';
import { assertPatientAccess } from '../middleware/patientAccess';
import { AppError } from '../middleware/errorHandler';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseId(raw: string): number {
  const id = parseInt(raw, 10);
  if (isNaN(id)) throw new AppError('Invalid ID', 400);
  return id;
}

// ─── Assignment handlers ───────────────────────────────────────────────────────

export async function getAssignments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);
    const activeOnly = req.query.active !== 'false';
    const assignments = await assignmentService.getAssignmentsForPatient(patientId, activeOnly);
    res.json({ status: 'ok', data: assignments });
  } catch (err) { next(err); }
}

export async function getTodaySchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);
    const schedule = await assignmentService.getTodaySchedule(patientId);
    res.json({ status: 'ok', data: schedule });
  } catch (err) { next(err); }
}

export async function createAssignment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);
    const { medicationId, frequency, timesPerDay, timesOfDay, startDate, endDate, refillsAllowed } = req.body;

    if (!medicationId || !startDate) {
      res.status(400).json({
        status: 'error',
        message: 'medicationId and startDate are required',
      });
      return;
    }

    const assignment = await assignmentService.createAssignment({
      patientId,
      medicationId: Number(medicationId),
      frequency: frequency || undefined,
      timesPerDay: timesPerDay !== undefined ? Number(timesPerDay) : undefined,
      timesOfDay: timesOfDay ?? [],
      startDate,
      endDate: endDate ?? null,
      refillsAllowed: refillsAllowed !== undefined ? Number(refillsAllowed) : undefined,
      prescribedById: req.user!.id,
    });
    res.status(201).json({ status: 'ok', data: assignment });
  } catch (err) { next(err); }
}

export async function updateAssignment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);
    const id = parseId(req.params.id);
    const updated = await assignmentService.updateAssignment(id, req.body);
    res.json({ status: 'ok', data: updated });
  } catch (err) { next(err); }
}

export async function recordRefill(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);
    const id = parseId(req.params.id);
    const updated = await assignmentService.recordRefill(id);
    res.json({ status: 'ok', data: updated });
  } catch (err) { next(err); }
}

export async function deactivateAssignment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);
    const id = parseId(req.params.id);
    await assignmentService.deactivateAssignment(id);
    res.json({ status: 'ok', message: 'Assignment deactivated' });
  } catch (err) { next(err); }
}

// ─── Dose log handlers ────────────────────────────────────────────────────────

export async function getLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const assignmentId = parseId(req.params.id);
    const limit = Math.min(Number(req.query.limit ?? 30), 100);
    const offset = Number(req.query.offset ?? 0);

    const assignment = await assignmentService.getAssignmentById(assignmentId);
    await assertPatientAccess(req, assignment.patient.id);

    const logs = await assignmentService.getLogsForAssignment(assignmentId, limit, offset);
    res.json({ status: 'ok', data: logs });
  } catch (err) { next(err); }
}

export async function createLog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const assignmentId = parseId(req.params.id);
    const { status, notes } = req.body;

    const validStatuses: DoseStatus[] = ['TAKEN', 'MISSED', 'SKIPPED'];
    if (!status || !validStatuses.includes(status as DoseStatus)) {
      res.status(400).json({
        status: 'error',
        message: `status must be one of: ${validStatuses.join(', ')}`,
      });
      return;
    }

    const assignment = await assignmentService.getAssignmentById(assignmentId);
    await assertPatientAccess(req, assignment.patient.id);

    const log = await assignmentService.logDose(
      assignmentId,
      req.user!.id,
      req.user!.role,
      status as DoseStatus,
      notes,
    );
    res.status(201).json({ status: 'ok', data: log });
  } catch (err) { next(err); }
}
