import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from './Modal';
import { createDocument, updateDocument } from '../api/documents';
import type { Document } from '../api/documents';
import { getAppointments } from '../api/appointments';
import type { Appointment } from '../api/appointments';
import { ApiError } from '../api/client';

interface Props {
  patientId: number;
  editingDocument?: Document;
  onClose: () => void;
  onSaved: (document: Document) => void;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export function DocumentModal({ patientId, editingDocument, onClose, onSaved }: Props) {
  const isEditing = !!editingDocument;
  const [file, setFile] = useState<File | null>(null);
  const [tag, setTag] = useState(editingDocument?.tag ?? '');
  const [appointmentId, setAppointmentId] = useState(editingDocument?.appointmentId ? String(editingDocument.appointmentId) : '');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getAppointments(patientId).then(setAppointments).catch(() => {});
  }, [patientId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isEditing && !file) {
      setError('Choose a file');
      return;
    }

    setLoading(true);
    try {
      const data = {
        tag: tag.trim() || null,
        appointmentId: appointmentId ? Number(appointmentId) : null,
      };
      const saved = isEditing
        ? await updateDocument(patientId, editingDocument.id, { file, ...data })
        : await createDocument(patientId, file!, data);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not ${isEditing ? 'update' : 'upload'} document.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={isEditing ? 'Edit Document' : 'Upload Document'}
      subtitle={isEditing ? 'Replace the file and/or update its details' : "Add a document to this patient's record"}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

        <div className="field">
          <label htmlFor="doc-file">{isEditing ? 'Replace file (optional)' : 'File'}</label>
          <input
            id="doc-file"
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {isEditing && !file && (
            <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 6 }}>
              Leave blank to keep the current file.
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="doc-tag">Tag</label>
          <input
            id="doc-tag"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="e.g. Lab Report, Insurance, Scan"
          />
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="doc-appointment">Attach to visit (optional)</label>
          <select id="doc-appointment" value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)}>
            <option value="">— None —</option>
            {appointments.map((a) => (
              <option key={a.id} value={a.id}>{formatWhen(a.scheduledFor)} · {a.reason || 'No reason given'}</option>
            ))}
          </select>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving…' : isEditing ? 'Save changes' : 'Upload'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
