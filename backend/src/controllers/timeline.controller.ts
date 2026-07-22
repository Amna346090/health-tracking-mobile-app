import { Request, Response, NextFunction } from 'express';
import { getTimeline, getSummary } from '../services/timeline.service';
import { assertPatientAccess } from '../middleware/patientAccess';

export async function getPatientTimeline(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const patientId = Number(req.params.patientId);
    if (isNaN(patientId)) { res.status(400).json({ status: 'error', message: 'Invalid patientId' }); return; }

    await assertPatientAccess(req, patientId);

    const limit  = Math.min(Number(req.query.limit ?? 30), 100);
    const before = req.query.before ? new Date(req.query.before as string) : undefined;

    const events = await getTimeline(patientId, limit, before);
    res.json({ status: 'ok', data: events });
  } catch (err) {
    next(err);
  }
}

export async function getPatientSummary(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const patientId = Number(req.params.patientId);
    if (isNaN(patientId)) { res.status(400).json({ status: 'error', message: 'Invalid patientId' }); return; }

    await assertPatientAccess(req, patientId);

    const summary = await getSummary(patientId);
    res.json({ status: 'ok', data: summary });
  } catch (err) {
    next(err);
  }
}
