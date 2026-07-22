import { Request, Response, NextFunction } from 'express';
import { FeelingStatus } from '@prisma/client';
import * as healthLogService from '../services/healthLog.service';
import { assertPatientAccess } from '../middleware/patientAccess';
import { AppError } from '../middleware/errorHandler';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseId(raw: string): number {
  const id = parseInt(raw, 10);
  if (isNaN(id)) throw new AppError('Invalid ID', 400);
  return id;
}

const VALID_FEELINGS = new Set<string>(['GREAT', 'GOOD', 'OKAY', 'POOR', 'TERRIBLE']);

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function listLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);

    const from = req.query.from ? new Date(req.query.from as string) : undefined;
    const to   = req.query.to   ? new Date(req.query.to   as string) : undefined;
    const limit  = Math.min(Number(req.query.limit  ?? 20),  100);
    const offset = Number(req.query.offset ?? 0);

    const logs = await healthLogService.getHealthLogs(patientId, { from, to, limit, offset });
    res.json({ status: 'ok', data: logs });
  } catch (err) { next(err); }
}

export async function getLog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    const logId     = parseId(req.params.logId);
    await assertPatientAccess(req, patientId);

    const log = await healthLogService.getHealthLogById(logId);
    if (log.patientId !== patientId) throw new AppError('Not found', 404);

    res.json({ status: 'ok', data: log });
  } catch (err) { next(err); }
}

export async function createLog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);

    const { date, weight, height, feeling, notes } = req.body;
    if (!date) {
      res.status(400).json({ status: 'error', message: 'date is required' });
      return;
    }
    if (feeling !== undefined && feeling !== null && !VALID_FEELINGS.has(feeling)) {
      res.status(400).json({ status: 'error', message: `feeling must be one of: ${[...VALID_FEELINGS].join(', ')}` });
      return;
    }

    const log = await healthLogService.createHealthLog({
      patientId,
      date,
      weight: weight != null ? Number(weight) : null,
      height: height != null ? Number(height) : null,
      feeling: (feeling as FeelingStatus) ?? null,
      notes: notes ?? null,
      createdById: req.user!.id,
    });
    res.status(201).json({ status: 'ok', data: log });
  } catch (err) { next(err); }
}

export async function updateLog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    const logId     = parseId(req.params.logId);
    await assertPatientAccess(req, patientId);

    const existing = await healthLogService.getHealthLogById(logId);
    if (existing.patientId !== patientId) throw new AppError('Not found', 404);

    const { date, weight, height, feeling, notes } = req.body;
    if (feeling !== undefined && feeling !== null && !VALID_FEELINGS.has(feeling)) {
      res.status(400).json({ status: 'error', message: `feeling must be one of: ${[...VALID_FEELINGS].join(', ')}` });
      return;
    }

    const updated = await healthLogService.updateHealthLog(logId, {
      date,
      weight: weight !== undefined ? (weight != null ? Number(weight) : null) : undefined,
      height: height !== undefined ? (height != null ? Number(height) : null) : undefined,
      feeling: feeling !== undefined ? (feeling as FeelingStatus | null) : undefined,
      notes,
    });
    res.json({ status: 'ok', data: updated });
  } catch (err) { next(err); }
}

export async function deleteLog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    const logId     = parseId(req.params.logId);
    await assertPatientAccess(req, patientId);

    const existing = await healthLogService.getHealthLogById(logId);
    if (existing.patientId !== patientId) throw new AppError('Not found', 404);

    await healthLogService.deleteHealthLog(logId);
    res.json({ status: 'ok', data: null });
  } catch (err) { next(err); }
}

export async function getWeightTrend(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);

    const days = Math.min(Number(req.query.days ?? 30), 365);
    const trend = await healthLogService.getWeightTrend(patientId, days);
    res.json({ status: 'ok', data: trend });
  } catch (err) { next(err); }
}
