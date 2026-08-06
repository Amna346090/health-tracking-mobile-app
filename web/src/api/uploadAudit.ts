import { api } from './client';

export type UploadEntityType = 'PHOTO' | 'DOCUMENT';
export type UploadAuditAction = 'UPLOADED' | 'EDITED' | 'DELETED';

export interface UploadAuditLogEntry {
  id: number;
  patientId: number;
  entityType: UploadEntityType;
  entityId: number;
  action: UploadAuditAction;
  detail: string | null;
  createdAt: string;
  performedBy: { id: number; firstName: string; lastName: string; role: string };
}

export const getUploadHistory = (patientId: number) =>
  api.get<UploadAuditLogEntry[]>(`/patients/${patientId}/upload-history`);
