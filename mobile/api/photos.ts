import { api } from './client';

export interface Photo {
  id:          number;
  patientId:   number;
  healthLogId: number | null;
  url:         string;
  key:         string | null;
  caption:     string | null;
  uploadedAt:  string;
  uploadedBy:  { id: number; firstName: string; lastName: string; role: string };
}

export interface PresignResult {
  uploadUrl: string;
  publicUrl: string;
  key:       string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export function getPhotos(
  patientId: number,
  opts?: { limit?: number; offset?: number },
): Promise<Photo[]> {
  const p = new URLSearchParams();
  if (opts?.limit)  p.set('limit',  String(opts.limit));
  if (opts?.offset) p.set('offset', String(opts.offset));
  const qs = p.toString();
  return api.get<Photo[]>(`/patients/${patientId}/photos${qs ? `?${qs}` : ''}`);
}

export function getPhotoById(id: number): Promise<Photo> {
  return api.get<Photo>(`/photos/${id}`);
}

export function deletePhoto(id: number): Promise<unknown> {
  return api.delete(`/photos/${id}`);
}

// ─── Upload helper ────────────────────────────────────────────────────────────

export interface UploadOptions {
  patientId:    number;
  uri:          string;
  mimeType:     string;
  filename:     string;
  caption?:     string | null;
  healthLogId?: number | null;
  onProgress?:  (fraction: number) => void;
}

/**
 * Full upload flow:
 *  1. Get pre-signed PUT URL from backend
 *  2. PUT image bytes to S3 via XHR (gives progress events)
 *  3. POST photo record to backend
 */
export async function uploadPhoto(opts: UploadOptions): Promise<Photo> {
  const { patientId, uri, mimeType, filename, caption, healthLogId, onProgress } = opts;

  // 1. Pre-sign
  const presign = await api.post<PresignResult>(`/patients/${patientId}/photos/presign`, {
    filename,
    contentType: mimeType,
  });

  // 2. Read local file → Blob
  const localRes = await fetch(uri);
  const blob     = await localRes.blob();

  // 3. Upload to S3 with progress tracking via XHR
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presign.uploadUrl);
    xhr.setRequestHeader('Content-Type', mimeType);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
    }
    xhr.onload  = () => (xhr.status < 400 ? resolve() : reject(new Error(`S3 upload HTTP ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(blob);
  });

  onProgress?.(1);

  // 4. Save Photo record
  return api.post<Photo>(`/patients/${patientId}/photos`, {
    url:         presign.publicUrl,
    key:         presign.key,
    caption:     caption ?? null,
    healthLogId: healthLogId ?? null,
  });
}
