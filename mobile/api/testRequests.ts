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

export function submitTestRequest(patientId: number, id: number, documentId: number): Promise<TestRequest> {
  return api.patch<TestRequest>(`/patients/${patientId}/test-requests/${id}`, {
    status: 'SUBMITTED',
    documentId,
  });
}
