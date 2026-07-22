import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import * as prescriptionService from '../services/prescription.service';
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

export async function downloadPrescription(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);
    const id = parseId(req.params.id);
    const pdf = await prescriptionService.getPrescriptionPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="prescription.pdf"');
    res.send(pdf);
  } catch (err) { next(err); }
}
