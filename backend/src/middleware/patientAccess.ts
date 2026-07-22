import { Request } from 'express';
import { Role } from '@prisma/client';
import prisma from '../lib/prisma';
import { getPatientByUserId } from '../services/patient.service';
import { getProviderByUserId } from '../services/provider.service';
import { AppError } from './errorHandler';

/**
 * Shared access check for every patient-scoped endpoint across the app.
 *
 * - PATIENT: only their own record.
 * - STAFF: only patients on their own provider panel — UNLESS the patient has no
 *   provider assigned (providerId === null), which stays visible to every STAFF
 *   member. This "opt-in restriction" default means assigning a patient to a
 *   provider is what narrows access, not the other way around — safer for a live
 *   system than defaulting new/unassigned patients to invisible.
 * - ADMIN: unrestricted, same as before this feature existed.
 */
export async function assertPatientAccess(req: Request, patientId: number): Promise<void> {
  if (req.user!.role === Role.PATIENT) {
    const own = await getPatientByUserId(req.user!.id);
    if (!own || own.id !== patientId) throw new AppError('Forbidden', 403);
    return;
  }

  if (req.user!.role === Role.STAFF) {
    const patient = await prisma.patientProfile.findUnique({
      where: { id: patientId },
      select: { providerId: true },
    });
    if (!patient) throw new AppError('Patient not found', 404);
    if (patient.providerId !== null) {
      const provider = await getProviderByUserId(req.user!.id);
      if (!provider || patient.providerId !== provider.id) throw new AppError('Forbidden', 403);
    }
    return;
  }

  // ADMIN — unrestricted
}
