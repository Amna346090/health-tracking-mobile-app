import { Request, Response, NextFunction } from 'express';
import * as messageService from '../services/message.service';
import { assertPatientAccess } from '../middleware/patientAccess';
import { AppError } from '../middleware/errorHandler';

function parseId(raw: string): number {
  const id = parseInt(raw, 10);
  if (isNaN(id)) throw new AppError('Invalid ID', 400);
  return id;
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
    await assertPatientAccess(req, patientId);
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
