import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

const USER_SELECT = {
  id: true,
  email: true,
  role: true,
  firstName: true,
  lastName: true,
  createdAt: true,
} as const;

export async function getAllUsers() {
  return prisma.user.findMany({
    select: USER_SELECT,
    orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function deleteUser(targetId: number, requestedById: number) {
  if (targetId === requestedById) {
    throw new AppError('You cannot delete your own account', 400);
  }

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) {
    throw new AppError('User not found', 404);
  }

  // PATIENT accounts cascade cleanly via PatientProfile (logs, meds, photos, tokens) —
  // except MedicationLog, which has no patientId of its own (only assignmentId/userId,
  // both ON DELETE RESTRICT) so it's never swept up by the PatientProfile cascade and
  // must be deleted explicitly before the account can go.
  // STAFF/ADMIN accounts have no such cascade — block deletion if they authored
  // records elsewhere, since those rows require a non-null author (ON DELETE RESTRICT)
  // and silently deleting a patient's health history as a side effect would be wrong.
  if (target.role !== 'PATIENT') {
    const [healthLogs, photos, medicationLogs] = await Promise.all([
      prisma.healthLog.count({ where: { createdById: targetId } }),
      prisma.photo.count({ where: { uploadedById: targetId } }),
      prisma.medicationLog.count({ where: { userId: targetId } }),
    ]);
    const total = healthLogs + photos + medicationLogs;
    if (total > 0) {
      throw new AppError(
        `Cannot delete: this account has ${total} historical record(s) (health logs, photos, or dose logs) tied to it. Reassign or archive them first.`,
        409,
      );
    }
    await prisma.user.delete({ where: { id: targetId } });
    return;
  }

  const patientProfile = await prisma.patientProfile.findUnique({ where: { userId: targetId } });
  await prisma.$transaction([
    ...(patientProfile
      ? [
          prisma.medicationLog.deleteMany({
            where: { assignment: { patientId: patientProfile.id } },
          }),
        ]
      : []),
    prisma.medicationLog.deleteMany({ where: { userId: targetId } }),
    prisma.user.delete({ where: { id: targetId } }),
  ]);
}

export async function resetPassword(targetId: number, newPassword: string) {
  if (newPassword.length < 8) {
    throw new AppError('New password must be at least 8 characters', 400);
  }

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) {
    throw new AppError('User not found', 404);
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: targetId }, data: { passwordHash } }),
    // Force the account to re-authenticate everywhere with the new password.
    prisma.refreshToken.deleteMany({ where: { userId: targetId } }),
  ]);
}
