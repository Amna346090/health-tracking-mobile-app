import { Request, Response, NextFunction } from 'express';
import { HealthMetricType, Role } from '@prisma/client';
import * as healthMetricService from '../services/healthMetric.service';
import { getPatientByUserId } from '../services/patient.service';
import { AppError } from '../middleware/errorHandler';

const VALID_TYPES: HealthMetricType[] = [
  'CHOLESTEROL_TOTAL', 'CHOLESTEROL_LDL', 'CHOLESTEROL_HDL', 'TRIGLYCERIDES',
  'BLOOD_GLUCOSE', 'BLOOD_PRESSURE_SYSTOLIC', 'BLOOD_PRESSURE_DIASTOLIC', 'OTHER',
];

function parseId(raw: string): number {
  const id = parseInt(raw, 10);
  if (isNaN(id)) throw new AppError('Invalid ID', 400);
  return id;
}

async function assertPatientAccess(req: Request, patientId: number): Promise<void> {
  if (req.user!.role !== Role.PATIENT) return;
  const own = await getPatientByUserId(req.user!.id);
  if (!own || own.id !== patientId) throw new AppError('Forbidden', 403);
}

export async function listMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);

    const { type } = req.query;
    if (type !== undefined && !VALID_TYPES.includes(type as HealthMetricType)) {
      res.status(400).json({ status: 'error', message: `type must be one of: ${VALID_TYPES.join(', ')}` });
      return;
    }

    const metrics = await healthMetricService.getMetricsForPatient(patientId, type as HealthMetricType | undefined);
    res.json({ status: 'ok', data: metrics });
  } catch (err) { next(err); }
}

export async function getTrend(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);

    const { type } = req.query;
    if (!type || !VALID_TYPES.includes(type as HealthMetricType)) {
      res.status(400).json({ status: 'error', message: `type must be one of: ${VALID_TYPES.join(', ')}` });
      return;
    }

    const limit = Math.min(Number(req.query.limit ?? 30), 100);
    const trend = await healthMetricService.getMetricTrend(patientId, type as HealthMetricType, limit);
    res.json({ status: 'ok', data: trend });
  } catch (err) { next(err); }
}

export async function createMetric(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);

    const { type, label, value, unit, recordedAt, documentId } = req.body;
    if (!type || !VALID_TYPES.includes(type)) {
      res.status(400).json({ status: 'error', message: `type must be one of: ${VALID_TYPES.join(', ')}` });
      return;
    }
    if (value === undefined || value === null || isNaN(Number(value))) {
      res.status(400).json({ status: 'error', message: 'value is required and must be a number' });
      return;
    }
    if (!recordedAt || isNaN(new Date(recordedAt).getTime())) {
      res.status(400).json({ status: 'error', message: 'A valid recordedAt date is required' });
      return;
    }

    const metric = await healthMetricService.createMetric({
      patientId,
      type,
      label: label ?? null,
      value: Number(value),
      unit: unit ?? null,
      recordedAt,
      documentId: documentId ?? null,
      createdById: req.user!.id,
    });
    res.status(201).json({ status: 'ok', data: metric });
  } catch (err) { next(err); }
}

export async function deleteMetric(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    const id = parseId(req.params.id);
    await assertPatientAccess(req, patientId);

    const existing = await healthMetricService.getMetricById(id);
    if (existing.patientId !== patientId) throw new AppError('Not found', 404);

    await healthMetricService.deleteMetric(id);
    res.json({ status: 'ok', data: null });
  } catch (err) { next(err); }
}
