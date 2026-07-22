import { Request, Response, NextFunction } from 'express';
import { AppointmentStatus, Role } from '@prisma/client';
import * as appointmentService from '../services/appointment.service';
import { assertPatientAccess } from '../middleware/patientAccess';
import { AppError } from '../middleware/errorHandler';

const VALID_STATUSES: AppointmentStatus[] = ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'];

function parseId(raw: string): number {
  const id = parseInt(raw, 10);
  if (isNaN(id)) throw new AppError('Invalid ID', 400);
  return id;
}

export async function getAppointments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);
    const appointments = await appointmentService.getAppointmentsForPatient(patientId);
    res.json({ status: 'ok', data: appointments });
  } catch (err) { next(err); }
}

export async function getAllAppointments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, from, to } = req.query;
    if (status !== undefined && !VALID_STATUSES.includes(status as AppointmentStatus)) {
      res.status(400).json({
        status: 'error',
        message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
      });
      return;
    }
    const appointments = await appointmentService.getAllAppointments({
      status: status as AppointmentStatus | undefined,
      from: typeof from === 'string' ? from : undefined,
      to: typeof to === 'string' ? to : undefined,
    });
    res.json({ status: 'ok', data: appointments });
  } catch (err) { next(err); }
}

export async function createAppointment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientId = parseId(req.params.patientId);
    await assertPatientAccess(req, patientId);

    const { scheduledFor, reason, notes, providerId, durationMinutes } = req.body;
    if (!scheduledFor || isNaN(new Date(scheduledFor).getTime())) {
      res.status(400).json({ status: 'error', message: 'A valid scheduledFor date/time is required' });
      return;
    }

    const appointment = await appointmentService.createAppointment({
      patientId,
      scheduledFor,
      reason: reason ?? null,
      notes: notes ?? null,
      providerId: providerId ?? null,
      durationMinutes: durationMinutes ?? null,
      createdById: req.user!.id,
    });
    res.status(201).json({ status: 'ok', data: appointment });
  } catch (err) { next(err); }
}

export async function updateAppointment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseId(req.params.id);
    const existing = await appointmentService.getAppointmentById(id);
    const patientId = existing.patient.id;
    await assertPatientAccess(req, patientId);

    const { scheduledFor, reason, notes, status, providerId, durationMinutes } = req.body;

    if (req.user!.role === Role.PATIENT) {
      if (existing.status === AppointmentStatus.COMPLETED || existing.status === AppointmentStatus.CANCELLED) {
        throw new AppError('This appointment can no longer be modified', 400);
      }
      if (status !== undefined && status !== AppointmentStatus.CANCELLED) {
        throw new AppError('Forbidden', 403);
      }
      if (notes !== undefined) {
        throw new AppError('Forbidden', 403);
      }
    }

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      res.status(400).json({
        status: 'error',
        message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
      });
      return;
    }

    if (scheduledFor !== undefined && isNaN(new Date(scheduledFor).getTime())) {
      res.status(400).json({ status: 'error', message: 'Invalid scheduledFor date/time' });
      return;
    }

    const updated = await appointmentService.updateAppointment(id, {
      scheduledFor,
      reason,
      notes,
      status,
      providerId,
      durationMinutes,
    });
    res.json({ status: 'ok', data: updated });
  } catch (err) { next(err); }
}
