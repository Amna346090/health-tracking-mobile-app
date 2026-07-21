import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import * as messageService from '../services/message.service';
import { getPatientByUserId } from '../services/patient.service';
import { AppError } from '../middleware/errorHandler';

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

export async function listMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);
    const messages = await messageService.listMessagesForPatient(patientId);
    res.json({ status: 'ok', data: messages });
  } catch (err) { next(err); }
}

export async function sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    const { body } = req.body;
    if (!body || typeof body !== 'string' || !body.trim()) {
      res.status(400).json({ status: 'error', message: 'body is required' });
      return;
    }

    const message = await messageService.createMessage({
      patientId,
      senderId: req.user!.id,
      body: body.trim(),
    });
    res.status(201).json({ status: 'ok', data: message });
  } catch (err) { next(err); }
}

export async function markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);
    const id = parseId(req.params.id);
    const message = await messageService.markMessageRead(id, req.user!.id);
    res.json({ status: 'ok', data: message });
  } catch (err) { next(err); }
}
