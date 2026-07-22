import { Request, Response, NextFunction } from 'express';
import * as patientService from '../services/patient.service';
import { getOverdueOrNearingPatients } from '../services/touchBase.service';
import { AppError } from '../middleware/errorHandler';

function parseId(raw: string): number {
  const id = parseInt(raw, 10);
  if (isNaN(id)) throw new AppError('Invalid ID', 400);
  return id;
}

export async function markContacted(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    const updated = await patientService.markContacted(patientId);
    res.json({ status: 'ok', data: updated });
  } catch (err) { next(err); }
}

export async function getQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const queue = await getOverdueOrNearingPatients();
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
