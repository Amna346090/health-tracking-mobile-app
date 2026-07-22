import { Request, Response, NextFunction } from 'express';
import * as documentService from '../services/document.service';
import { assertPatientAccess } from '../middleware/patientAccess';
import { presignUpload, deleteObject } from '../lib/s3';
import { AppError } from '../middleware/errorHandler';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseId(raw: string): number {
  const id = parseInt(raw, 10);
  if (isNaN(id)) throw new AppError('Invalid ID', 400);
  return id;
}

// ─── Patient-scoped handlers ──────────────────────────────────────────────────

export async function getPresignedUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);

    const { filename, contentType } = req.body as { filename?: string; contentType?: string };
    if (!filename || !contentType) {
      res.status(400).json({ status: 'error', message: 'filename and contentType are required' });
      return;
    }

    const result = await presignUpload(patientId, filename, contentType, 'documents');
    res.json({ status: 'ok', data: result });
  } catch (err) { next(err); }
}

export async function listDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);

    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const offset = Number(req.query.offset ?? 0);

    const documents = await documentService.getDocuments(patientId, limit, offset);
    res.json({ status: 'ok', data: documents });
  } catch (err) { next(err); }
}

export async function createDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);

    const { url, key, fileType, tag, appointmentId } = req.body as {
      url: string;
      key?: string | null;
      fileType: string;
      tag?: string | null;
      appointmentId?: number | null;
    };

    if (!url?.trim() || !fileType?.trim()) {
      res.status(400).json({ status: 'error', message: 'url and fileType are required' });
      return;
    }

    const document = await documentService.createDocument({
      patientId,
      url: url.trim(),
      key: key ?? null,
      fileType: fileType.trim(),
      tag: tag ?? null,
      appointmentId: appointmentId ?? null,
      uploadedById: req.user!.id,
    });
    res.status(201).json({ status: 'ok', data: document });
  } catch (err) { next(err); }
}

// ─── Standalone document handlers ─────────────────────────────────────────────

export async function getDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseId(req.params.id);
    const document = await documentService.getDocumentById(id);
    await assertPatientAccess(req, document.patientId);

    res.json({ status: 'ok', data: document });
  } catch (err) { next(err); }
}

export async function updateDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseId(req.params.id);
    const document = await documentService.getDocumentById(id);
    await assertPatientAccess(req, document.patientId);

    const { tag, appointmentId } = req.body as { tag?: string | null; appointmentId?: number | null };
    const updated = await documentService.updateDocument(id, { tag, appointmentId });
    res.json({ status: 'ok', data: updated });
  } catch (err) { next(err); }
}

export async function removeDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseId(req.params.id);
    const document = await documentService.getDocumentById(id);
    await assertPatientAccess(req, document.patientId);

    const { key } = await documentService.deleteDocument(id);

    if (key) {
      deleteObject(key).catch((e) => {
        console.error(`[document] S3 delete failed for key "${key}":`, e);
      });
    }

    res.json({ status: 'ok', data: null });
  } catch (err) { next(err); }
}
