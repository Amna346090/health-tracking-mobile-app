import { api } from './client';

export interface Document {
  id: number;
  patientId: number;
  appointmentId: number | null;
  fileType: string;
  tag: string | null;
  url: string;
  key: string | null;
  uploadedById: number;
  uploadedAt: string;
  uploadedBy: { id: number; firstName: string; lastName: string; role: string };
}

export interface PresignResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

export function getDocuments(
  patientId: number,
  opts?: { limit?: number; offset?: number },
): Promise<Document[]> {
  const p = new URLSearchParams();
  if (opts?.limit) p.set('limit', String(opts.limit));
  if (opts?.offset) p.set('offset', String(opts.offset));
  const qs = p.toString();
  return api.get<Document[]>(`/patients/${patientId}/documents${qs ? `?${qs}` : ''}`);
}

export interface UploadDocumentOptions {
  patientId: number;
  uri: string;
  mimeType: string;
  filename: string;
  onProgress?: (fraction: number) => void;
}

/**
 * Full upload flow (mirrors mobile/api/photos.ts#uploadPhoto, generalized for any file type):
 *  1. Get pre-signed PUT URL from backend
 *  2. PUT file bytes to S3/R2 via XHR (gives progress events)
 *  3. POST document record to backend
 */
export async function uploadDocument(opts: UploadDocumentOptions): Promise<Document> {
  const { patientId, uri, mimeType, filename, onProgress } = opts;

  const presign = await api.post<PresignResult>(`/patients/${patientId}/documents/presign`, {
    filename,
    contentType: mimeType,
  });

  const localRes = await fetch(uri);
  const blob = await localRes.blob();

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presign.uploadUrl);
    xhr.setRequestHeader('Content-Type', mimeType);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
    }
    xhr.onload = () => (xhr.status < 400 ? resolve() : reject(new Error(`Upload HTTP ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(blob);
  });

  onProgress?.(1);

  return api.post<Document>(`/patients/${patientId}/documents`, {
    url: presign.publicUrl,
    key: presign.key,
    fileType: mimeType,
  });
}
