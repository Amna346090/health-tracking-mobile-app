import { TestRequestStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

const PATIENT_SUMMARY_SELECT = {
  id: true,
  user: { select: { firstName: true, lastName: true, email: true } },
} as const;

function todayDateOnly(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function getTestRequestsForPatient(patientId: number) {
  return prisma.testRequest.findMany({
    where: { patientId },
    orderBy: { dueDate: 'asc' },
  });
}

export interface TestRequestFilters {
  status?: TestRequestStatus;
  overdueOnly?: boolean;
}

export async function getAllTestRequests(filters: TestRequestFilters = {}) {
  const { status, overdueOnly } = filters;
  return prisma.testRequest.findMany({
    where: {
      ...(status && { status }),
      ...(overdueOnly && {
        status: TestRequestStatus.PENDING,
        dueDate: { lt: todayDateOnly() },
      }),
    },
    include: { patient: { select: PATIENT_SUMMARY_SELECT } },
    orderBy: { dueDate: 'asc' },
  });
}

export async function getTestRequestById(id: number) {
  const testRequest = await prisma.testRequest.findUnique({
    where: { id },
    include: { patient: { select: { id: true, userId: true } } },
  });
  if (!testRequest) throw new AppError('Test request not found', 404);
  return testRequest;
}

export interface CreateTestRequestInput {
  patientId: number;
  name: string;
  instructions?: string | null;
  dueDate: string;
  requestedById: number;
}

export async function createTestRequest(data: CreateTestRequestInput) {
  const patient = await prisma.patientProfile.findUnique({ where: { id: data.patientId } });
  if (!patient) throw new AppError('Patient not found', 404);

  return prisma.testRequest.create({
    data: {
      patientId: data.patientId,
      name: data.name,
      instructions: data.instructions ?? null,
      dueDate: new Date(data.dueDate),
      requestedById: data.requestedById,
      status: TestRequestStatus.PENDING,
    },
  });
}

export interface UpdateTestRequestInput {
  name?: string;
  instructions?: string | null;
  dueDate?: string;
  status?: TestRequestStatus;
  documentId?: number | null;
}

export async function updateTestRequest(id: number, data: UpdateTestRequestInput) {
  const exists = await prisma.testRequest.findUnique({ where: { id } });
  if (!exists) throw new AppError('Test request not found', 404);

  if (data.documentId) {
    const document = await prisma.document.findUnique({ where: { id: data.documentId } });
    if (!document || document.patientId !== exists.patientId) {
      throw new AppError('Document does not belong to this patient', 400);
    }
  }

  return prisma.testRequest.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.instructions !== undefined && { instructions: data.instructions }),
      ...(data.dueDate !== undefined && { dueDate: new Date(data.dueDate) }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.documentId !== undefined && { documentId: data.documentId }),
    },
  });
}
