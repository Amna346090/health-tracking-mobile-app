import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

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

  return prisma.photo.create({
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
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/** Removes the DB record and returns the S3 key so the caller can clean up storage. */
export async function deletePhoto(id: number): Promise<{ key: string | null }> {
  const photo = await prisma.photo.findUnique({
    where:  { id },
    select: { id: true, key: true, patientId: true, uploadedById: true },
  });
  if (!photo) throw new AppError('Photo not found', 404);
  await prisma.photo.delete({ where: { id } });
  return { key: photo.key };
}
