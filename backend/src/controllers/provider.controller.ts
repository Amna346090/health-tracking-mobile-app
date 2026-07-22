import { Request, Response, NextFunction } from 'express';
import * as providerService from '../services/provider.service';
import { AppError } from '../middleware/errorHandler';

function parseId(raw: string): number {
  const id = parseInt(raw, 10);
  if (isNaN(id)) throw new AppError('Invalid ID', 400);
  return id;
}

export async function getAllProviders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const providers = await providerService.getAllProviders();
    res.json({ status: 'ok', data: providers });
  } catch (err) { next(err); }
}

export async function updateProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseId(req.params.id);
    const { npi, credentials, specialty } = req.body;
    const provider = await providerService.updateProvider(id, { npi, credentials, specialty });
    res.json({ status: 'ok', data: provider });
  } catch (err) { next(err); }
}
