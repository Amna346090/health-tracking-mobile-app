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

export function getTestRequests(patientId: number): Promise<TestRequest[]> {
  return api.get<TestRequest[]>(`/patients/${patientId}/test-requests`);
}

export interface TestRequestWithPatient extends TestRequest {
  patient: { id: number; user: { firstName: string; lastName: string; email: string } };
}

export function getAllTestRequests(params?: { overdue?: boolean }): Promise<TestRequestWithPatient[]> {
  const qs = params?.overdue ? '?overdue=true' : '';
  return api.get<TestRequestWithPatient[]>(`/test-requests${qs}`);
}

export function submitTestRequest(patientId: number, id: number, documentId: number): Promise<TestRequest> {
  return api.patch<TestRequest>(`/patients/${patientId}/test-requests/${id}`, {
    status: 'SUBMITTED',
    documentId,
  });
}

export function createTestRequest(
  patientId: number,
  data: { name: string; instructions?: string | null; dueDate: string },
): Promise<TestRequest> {
  return api.post<TestRequest>(`/patients/${patientId}/test-requests`, data);
}

export function updateTestRequest(
  patientId: number,
  id: number,
  data: Partial<{ name: string; instructions: string | null; dueDate: string; status: TestRequestStatus }>,
): Promise<TestRequest> {
  return api.patch<TestRequest>(`/patients/${patientId}/test-requests/${id}`, data);
}
