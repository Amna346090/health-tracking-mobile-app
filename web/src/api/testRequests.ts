import { api } from './client';

export type TestRequestStatus = 'PENDING' | 'SUBMITTED' | 'CANCELLED';

export interface TestRequest {
  id: number;
  patientId: number;
  name: string;
  instructions: string | null;
  dueDate: string;
  status: TestRequestStatus;
  documentId: number | null;
  requestedById: number;
  createdAt: string;
  updatedAt: string;
}

export interface TestRequestWithPatient extends TestRequest {
  patient: {
    id: number;
    user: { firstName: string; lastName: string; email: string };
  };
}

export const getTestRequests = (patientId: number) =>
  api.get<TestRequest[]>(`/patients/${patientId}/test-requests`);

export const getAllTestRequests = (params?: { status?: TestRequestStatus; overdue?: boolean }) => {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.overdue) query.set('overdue', 'true');
  const qs = query.toString();
  return api.get<TestRequestWithPatient[]>(`/test-requests${qs ? `?${qs}` : ''}`);
};

export interface CreateTestRequestInput {
  name: string;
  instructions?: string | null;
  dueDate: string;
}

export const createTestRequest = (patientId: number, data: CreateTestRequestInput) =>
  api.post<TestRequest>(`/patients/${patientId}/test-requests`, data);

export interface UpdateTestRequestInput {
  name?: string;
  instructions?: string | null;
  dueDate?: string;
  status?: TestRequestStatus;
}

export const updateTestRequest = (patientId: number, id: number, data: UpdateTestRequestInput) =>
  api.patch<TestRequest>(`/patients/${patientId}/test-requests/${id}`, data);
