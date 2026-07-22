import { Request, Response, NextFunction } from 'express';
import { getReminderLogs } from '../services/reminder.service';
import { assertPatientAccess } from '../middleware/patientAccess';

export async function listReminderLogs(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const patientId = Number(req.params.patientId);
    if (isNaN(patientId)) {
      res.status(400).json({ status: 'error', message: 'Invalid patientId' });
      return;
    }

    await assertPatientAccess(req, patientId);

    const limit  = Math.min(Number(req.query.limit  ?? 50), 100);
    const offset = Number(req.query.offset ?? 0);

    const logs = await getReminderLogs(patientId, limit, offset);
    res.json({ status: 'ok', data: logs });
  } catch (err) {
    next(err);
  }
}
