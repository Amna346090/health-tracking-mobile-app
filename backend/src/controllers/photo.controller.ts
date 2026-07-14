import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import * as photoService from '../services/photo.service';
import { getPatientByUserId } from '../services/patient.service';
import { presignUpload, deleteObject } from '../lib/s3';
import { AppError } from '../middleware/errorHandler';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseId(raw: string): number {
  const id = parseInt(raw, 10);
  if (isNaN(id)) throw new AppError('Invalid ID', 400);
  return id;
}

async function assertPatientAccess(req: Request, patientId: number): Promise<void> {
  if (req.user!.role !== Role.PATIENT) return;
  const own = await getPatientByUserId(req.user!.id);
  if (!own || own.id !== patientId) throw new AppError('Forbidden', 403);
}

// ─── Patient-scoped handlers ──────────────────────────────────────────────────

export async function getPresignedUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId    = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);

    const { filename, contentType } = req.body as { filename?: string; contentType?: string };
    if (!filename || !contentType) {
      res.status(400).json({ status: 'error', message: 'filename and contentType are required' });
      return;
    }

    const result = await presignUpload(patientId, filename, contentType);
    res.json({ status: 'ok', data: result });
  } catch (err) { next(err); }
}

export async function listPhotos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);

    const limit  = Math.min(Number(req.query.limit  ?? 20),  100);
    const offset = Number(req.query.offset ?? 0);

    const photos = await photoService.getPhotos(patientId, limit, offset);
    res.json({ status: 'ok', data: photos });
  } catch (err) { next(err); }
}

export async function savePhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);

    const { url, key, caption, healthLogId } = req.body as {
      url: string;
      key?: string | null;
      caption?: string | null;
      healthLogId?: number | null;
    };

    if (!url?.trim()) {
      res.status(400).json({ status: 'error', message: 'url is required' });
      return;
    }

    const photo = await photoService.createPhoto({
      patientId,
      url:          url.trim(),
      key:          key ?? null,
      caption:      caption ?? null,
      healthLogId:  healthLogId ?? null,
      uploadedById: req.user!.id,
    });
    res.status(201).json({ status: 'ok', data: photo });
  } catch (err) { next(err); }
}

// ─── Standalone photo handler ─────────────────────────────────────────────────

export async function getPhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const photoId = parseId(req.params.id);
    const photo   = await photoService.getPhotoById(photoId);

    // Patients can only view their own photos
    if (req.user!.role === Role.PATIENT) {
      const own = await getPatientByUserId(req.user!.id);
      if (!own || photo.patientId !== own.id) throw new AppError('Forbidden', 403);
    }

    res.json({ status: 'ok', data: photo });
  } catch (err) { next(err); }
}

export async function removePhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const photoId = parseId(req.params.id);
    const photo   = await photoService.getPhotoById(photoId);

    // Patients can only delete their own photos
    if (req.user!.role === Role.PATIENT) {
      const own = await getPatientByUserId(req.user!.id);
      if (!own || photo.patientId !== own.id) throw new AppError('Forbidden', 403);
    }

    const { key } = await photoService.deletePhoto(photoId);

    // Best-effort S3 deletion — don't fail the request if storage cleanup errors
    if (key) {
      deleteObject(key).catch((e) => {
        console.error(`[photo] S3 delete failed for key "${key}":`, e);
      });
    }

    res.json({ status: 'ok', data: null });
  } catch (err) { next(err); }
}
