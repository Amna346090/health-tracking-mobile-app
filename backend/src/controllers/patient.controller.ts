import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import * as patientService from '../services/patient.service';
import { getProviderByUserId } from '../services/provider.service';
import { assertPatientAccess } from '../middleware/patientAccess';

export async function getAllPatients(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let providerId: number | undefined;

    if (req.user!.role === Role.STAFF) {
      // STAFF always see their own panel (+ unassigned patients, via getAllPatients' own filter logic) — never explicitly overridable.
      const provider = await getProviderByUserId(req.user!.id);
      providerId = provider?.id;
    } else if (req.user!.role === Role.ADMIN && typeof req.query.providerId === 'string') {
      // ADMIN can filter by any provider for reporting ("Dr. X's patients due for recall").
      const parsed = parseInt(req.query.providerId, 10);
      if (!isNaN(parsed)) providerId = parsed;
    }

    const patients = await patientService.getAllPatients({ providerId });
    res.json({ status: 'ok', data: patients });
  } catch (err) {
    next(err);
  }
}

export async function getOwnProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await patientService.getPatientByUserId(req.user!.id);
    if (!profile) {
      res.status(404).json({ status: 'error', message: 'Patient profile not found' });
      return;
    }
    res.json({ status: 'ok', data: profile });
  } catch (err) {
    next(err);
  }
}

export async function getPatientById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ status: 'error', message: 'Invalid patient ID' });
      return;
    }

    await assertPatientAccess(req, id);

    const profile = await patientService.getPatientById(id);
    if (!profile) {
      res.status(404).json({ status: 'error', message: 'Patient not found' });
      return;
    }

    res.json({ status: 'ok', data: profile });
  } catch (err) {
    next(err);
  }
}

export async function getPatientCredentials(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.patientId, 10);
    if (isNaN(id)) {
      res.status(400).json({ status: 'error', message: 'Invalid patient ID' });
      return;
    }

    const credentials = await patientService.getPatientCredentials(id);
    res.json({ status: 'ok', data: credentials });
  } catch (err) {
    next(err);
  }
}

export async function updatePatient(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ status: 'error', message: 'Invalid patient ID' });
      return;
    }

    await assertPatientAccess(req, id);

    const updated = await patientService.updatePatient(id, req.body);
    res.json({ status: 'ok', data: updated });
  } catch (err) {
    next(err);
  }
}
