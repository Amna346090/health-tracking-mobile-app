import { Request, Response } from 'express';
import { checkDatabaseConnection } from '../services/health.service';

export async function getHealthCheck(req: Request, res: Response): Promise<void> {
  const dbConnected = await checkDatabaseConnection();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbConnected ? 'connected' : 'disconnected',
  });
}
