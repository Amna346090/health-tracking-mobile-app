import { Request, Response, NextFunction } from 'express';
import * as uploadAuditService from '../services/uploadAudit.service';
import { AppError } from '../middleware/errorHandler';

export async function getUploadHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseInt(req.params.patientId, 10);
    if (isNaN(patientId)) throw new AppError('Invalid patient ID', 400);

    const history = await uploadAuditService.getUploadHistoryForPatient(patientId);
    res.json({ status: 'ok', data: history });
  } catch (err) { next(err); }
}
