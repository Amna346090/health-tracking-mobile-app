import { Request, Response, NextFunction } from 'express';
import * as medicationService from '../services/medication.service';

export async function getAllMedications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const meds = await medicationService.getAllMedications(search);
    res.json({ status: 'ok', data: meds });
  } catch (err) { next(err); }
}

export async function getMedicationById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ status: 'error', message: 'Invalid medication ID' }); return; }
    const med = await medicationService.getMedicationById(id);
    res.json({ status: 'ok', data: med });
  } catch (err) { next(err); }
}

export async function createMedication(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, dosage, form, quantityPerDose, foodInstruction, instructions, prescribingNotes } = req.body;
    if (!name?.trim() || !dosage?.trim()) {
      res.status(400).json({ status: 'error', message: 'name and dosage are required' });
      return;
    }
    if (quantityPerDose !== undefined && (!Number.isInteger(quantityPerDose) || quantityPerDose < 1)) {
      res.status(400).json({ status: 'error', message: 'quantityPerDose must be a positive integer' });
      return;
    }
    const med = await medicationService.createMedication({
      name: name.trim(),
      dosage: dosage.trim(),
      form,
      quantityPerDose,
      foodInstruction,
      instructions,
      prescribingNotes,
    });
    res.status(201).json({ status: 'ok', data: med });
  } catch (err) { next(err); }
}

export async function updateMedication(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ status: 'error', message: 'Invalid medication ID' }); return; }
    const { name, dosage, form, quantityPerDose, foodInstruction, instructions, prescribingNotes } = req.body;
    if (quantityPerDose !== undefined && (!Number.isInteger(quantityPerDose) || quantityPerDose < 1)) {
      res.status(400).json({ status: 'error', message: 'quantityPerDose must be a positive integer' });
      return;
    }
    const med = await medicationService.updateMedication(id, {
      name,
      dosage,
      form,
      quantityPerDose,
      foodInstruction,
      instructions,
      prescribingNotes,
    });
    res.json({ status: 'ok', data: med });
  } catch (err) { next(err); }
}
