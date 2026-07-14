import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import * as patientService from '../services/patient.service';

export async function getAllPatients(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patients = await patientService.getAllPatients();
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

    const profile = await patientService.getPatientById(id);
    if (!profile) {
      res.status(404).json({ status: 'error', message: 'Patient not found' });
      return;
    }

    if (req.user!.role === Role.PATIENT && profile.userId !== req.user!.id) {
      res.status(403).json({ status: 'error', message: 'Forbidden' });
      return;
    }

    res.json({ status: 'ok', data: profile });
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

    if (req.user!.role === Role.PATIENT) {
      const profile = await patientService.getPatientById(id);
      if (!profile || profile.userId !== req.user!.id) {
        res.status(403).json({ status: 'error', message: 'Forbidden' });
        return;
      }
    }

    const updated = await patientService.updatePatient(id, req.body);
    res.json({ status: 'ok', data: updated });
  } catch (err) {
    next(err);
  }
}
