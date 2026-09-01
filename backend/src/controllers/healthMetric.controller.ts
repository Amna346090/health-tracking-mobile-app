import { Request, Response, NextFunction } from 'express';
import * as healthMetricService from '../services/healthMetric.service';
import { assertPatientAccess } from '../middleware/patientAccess';
import { AppError } from '../middleware/errorHandler';

function parseId(raw: string): number {
  const id = parseInt(raw, 10);
  if (isNaN(id)) throw new AppError('Invalid ID', 400);
  return id;
}

function parseType(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function listMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);

    const type = parseType(req.query.type);
    const metrics = await healthMetricService.getMetricsForPatient(patientId, type);
    res.json({ status: 'ok', data: metrics });
  } catch (err) { next(err); }
}

export async function listMetricTypes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);

    const types = await healthMetricService.getMetricTypesForPatient(patientId);
    res.json({ status: 'ok', data: types });
  } catch (err) { next(err); }
}

export async function getTrend(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);

    const type = parseType(req.query.type);
    if (!type) {
      res.status(400).json({ status: 'error', message: 'type is required' });
      return;
    }

    const limit = Math.min(Number(req.query.limit ?? 30), 100);
    const trend = await healthMetricService.getMetricTrend(patientId, type, limit);
    res.json({ status: 'ok', data: trend });
  } catch (err) { next(err); }
}

export async function createMetric(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);

    const { label, value, unit, recordedAt, documentId } = req.body;
    const type = parseType(req.body.type);
    if (!type) {
      res.status(400).json({ status: 'error', message: 'type is required' });
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
