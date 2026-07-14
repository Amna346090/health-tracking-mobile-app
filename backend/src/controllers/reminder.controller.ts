import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import prisma from '../lib/prisma';
import { getReminderLogs } from '../services/reminder.service';
import { AppError } from '../middleware/errorHandler';

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

    // Patients may only view their own logs
    if (req.user!.role === Role.PATIENT) {
      const profile = await prisma.patientProfile.findUnique({
        where:  { userId: req.user!.id },
        select: { id: true },
      });
      if (!profile || profile.id !== patientId) {
        throw new AppError('Forbidden', 403);
      }
    }

    const limit  = Math.min(Number(req.query.limit  ?? 50), 100);
    const offset = Number(req.query.offset ?? 0);

    const logs = await getReminderLogs(patientId, limit, offset);
    res.json({ status: 'ok', data: logs });
  } catch (err) {
    next(err);
  }
}
