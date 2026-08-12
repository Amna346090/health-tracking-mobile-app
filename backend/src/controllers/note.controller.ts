import { Request, Response, NextFunction } from 'express';
import * as noteService from '../services/note.service';
import { assertPatientAccess } from '../middleware/patientAccess';
import { AppError } from '../middleware/errorHandler';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseId(raw: string): number {
  const id = parseInt(raw, 10);
  if (isNaN(id)) throw new AppError('Invalid ID', 400);
  return id;
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function listNotes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);

    const notes = await noteService.getNotes(patientId);
    res.json({ status: 'ok', data: notes });
  } catch (err) { next(err); }
}

export async function createNote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);

    const { body } = req.body as { body?: string };
    if (!body?.trim()) {
      res.status(400).json({ status: 'error', message: 'body is required' });
      return;
    }

    const note = await noteService.createNote({
      patientId,
      body: body.trim(),
      authorId: req.user!.id,
    });
    res.status(201).json({ status: 'ok', data: note });
  } catch (err) { next(err); }
}

export async function updateNote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    const noteId = parseId(req.params.noteId);
    await assertPatientAccess(req, patientId);

    const existing = await noteService.getNoteById(noteId);
    if (existing.patientId !== patientId) throw new AppError('Not found', 404);

    const { body } = req.body as { body?: string };
    if (!body?.trim()) {
      res.status(400).json({ status: 'error', message: 'body is required' });
      return;
    }

    const updated = await noteService.updateNote(noteId, body.trim());
    res.json({ status: 'ok', data: updated });
  } catch (err) { next(err); }
}

export async function removeNote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    const noteId = parseId(req.params.noteId);
    await assertPatientAccess(req, patientId);

    const existing = await noteService.getNoteById(noteId);
    if (existing.patientId !== patientId) throw new AppError('Not found', 404);

    await noteService.deleteNote(noteId);
    res.json({ status: 'ok', data: null });
  } catch (err) { next(err); }
}
