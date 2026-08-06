import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { logUploadAudit } from './uploadAudit.service';

const UPLOADER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
} as const;

// ─── List ─────────────────────────────────────────────────────────────────────

export async function getPhotos(
  patientId: number,
  limit = 20,
  offset = 0,
) {
  return prisma.photo.findMany({
    where: { patientId },
    include: { uploadedBy: { select: UPLOADER_SELECT } },
    orderBy: { uploadedAt: 'desc' },
    take:  Math.min(limit, 100),
    skip:  offset,
  });
}

export async function getPhotoById(id: number) {
  const photo = await prisma.photo.findUnique({
    where: { id },
    include: { uploadedBy: { select: UPLOADER_SELECT } },
  });
  if (!photo) throw new AppError('Photo not found', 404);
  return photo;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export interface CreatePhotoInput {
  patientId:    number;
  url:          string;
  key:          string | null;
  caption?:     string | null;
  healthLogId?: number | null;
  uploadedById: number;
}

export async function createPhoto(data: CreatePhotoInput) {
  const patient = await prisma.patientProfile.findUnique({ where: { id: data.patientId } });
  if (!patient) throw new AppError('Patient not found', 404);

  const photo = await prisma.photo.create({
    data: {
      patientId:    data.patientId,
      url:          data.url,
      key:          data.key ?? null,
      caption:      data.caption  ?? null,
      healthLogId:  data.healthLogId ?? null,
      uploadedById: data.uploadedById,
    },
    include: { uploadedBy: { select: UPLOADER_SELECT } },
  });

  await logUploadAudit({
    patientId: data.patientId,
    entityType: 'PHOTO',
    entityId: photo.id,
    action: 'UPLOADED',
    performedById: data.uploadedById,
  });

  return photo;
}

// ─── Update (replace file and/or caption) ─────────────────────────────────────

export interface UpdatePhotoInput {
  url?: string;
  key?: string | null;
  caption?: string | null;
}

/** Updates the record; returns the previous S3 key so the caller can clean up storage if the file was replaced. */
export async function updatePhoto(
  id: number,
  data: UpdatePhotoInput,
  performedById: number,
): Promise<{ photo: Awaited<ReturnType<typeof getPhotoById>>; previousKey: string | null }> {
  const existing = await prisma.photo.findUnique({ where: { id } });
  if (!existing) throw new AppError('Photo not found', 404);

  const fileReplaced = data.url !== undefined && data.url !== existing.url;

  const photo = await prisma.photo.update({
    where: { id },
    data: {
      ...(data.url !== undefined && { url: data.url }),
      ...(data.key !== undefined && { key: data.key }),
      ...(data.caption !== undefined && { caption: data.caption }),
    },
    include: { uploadedBy: { select: UPLOADER_SELECT } },
  });

  await logUploadAudit({
    patientId: existing.patientId,
    entityType: 'PHOTO',
    entityId: id,
    action: 'EDITED',
    performedById,
    detail: fileReplaced ? 'Replaced file' : 'Updated caption',
  });

  return { photo, previousKey: fileReplaced ? existing.key : null };
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/** Removes the DB record and returns the S3 key so the caller can clean up storage. */
export async function deletePhoto(id: number, performedById: number): Promise<{ key: string | null }> {
  const photo = await prisma.photo.findUnique({
    where:  { id },
    select: { id: true, key: true, patientId: true, uploadedById: true },
  });
  if (!photo) throw new AppError('Photo not found', 404);
  await prisma.photo.delete({ where: { id } });

  await logUploadAudit({
    patientId: photo.patientId,
    entityType: 'PHOTO',
    entityId: id,
    action: 'DELETED',
    performedById,
  });

  return { key: photo.key };
}
