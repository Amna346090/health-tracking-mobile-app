import { Request, Response, NextFunction } from 'express';
import * as prescriptionService from '../services/prescription.service';
import { assertPatientAccess } from '../middleware/patientAccess';
import { AppError } from '../middleware/errorHandler';

function parseId(raw: string): number {
  const id = parseInt(raw, 10);
  if (isNaN(id)) throw new AppError('Invalid ID', 400);
  return id;
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
