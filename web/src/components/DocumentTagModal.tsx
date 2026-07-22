import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from './Modal';
import { updateDocument } from '../api/documents';
import type { Document } from '../api/documents';
import { getAppointments } from '../api/appointments';
import type { Appointment } from '../api/appointments';
import { ApiError } from '../api/client';

interface Props {
  patientId: number;
  document: Document;
  onClose: () => void;
  onSaved: (document: Document) => void;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export function DocumentTagModal({ patientId, document, onClose, onSaved }: Props) {
  const [tag, setTag] = useState(document.tag ?? '');
  const [appointmentId, setAppointmentId] = useState(document.appointmentId ? String(document.appointmentId) : '');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getAppointments(patientId).then(setAppointments).catch(() => {});
  }, [patientId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const saved = await updateDocument(document.id, {
        tag: tag.trim() || null,
        appointmentId: appointmentId ? Number(appointmentId) : null,
      });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update document.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Tag Document" subtitle="Categorize and attach this document to a visit" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

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
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
