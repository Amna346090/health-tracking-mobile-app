import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import * as patientService from '../services/patient.service';
import { getOverdueOrNearingPatients } from '../services/touchBase.service';
import { getProviderByUserId } from '../services/provider.service';
import { assertPatientAccess } from '../middleware/patientAccess';
import { AppError } from '../middleware/errorHandler';

function parseId(raw: string): number {
  const id = parseInt(raw, 10);
  if (isNaN(id)) throw new AppError('Invalid ID', 400);
  return id;
}

export async function markContacted(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);
    const updated = await patientService.markContacted(patientId);
    res.json({ status: 'ok', data: updated });
  } catch (err) { next(err); }
}

export async function getQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let providerId: number | undefined;

    if (req.user!.role === Role.STAFF) {
      const provider = await getProviderByUserId(req.user!.id);
      providerId = provider?.id;
    } else if (req.user!.role === Role.ADMIN && typeof req.query.providerId === 'string') {
      const parsed = parseInt(req.query.providerId, 10);
      if (!isNaN(parsed)) providerId = parsed;
    }

    const queue = await getOverdueOrNearingPatients({ providerId });
    res.json({ status: 'ok', data: queue });
  } catch (err) { next(err); }
}

export async function getSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const settings = await patientService.getTouchBaseSettings();
    res.json({ status: 'ok', data: settings });
  } catch (err) { next(err); }
}

export async function updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { defaultThresholdDays } = req.body;
    if (!Number.isInteger(defaultThresholdDays) || defaultThresholdDays < 1) {
      res.status(400).json({ status: 'error', message: 'defaultThresholdDays must be a positive integer' });
      return;
    }
    const settings = await patientService.updateTouchBaseSettings(defaultThresholdDays);
    res.json({ status: 'ok', data: settings });
  } catch (err) { next(err); }
}
