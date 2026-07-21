import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from './Modal';
import { createAppointment, updateAppointment } from '../api/appointments';
import type { Appointment } from '../api/appointments';
import { ApiError } from '../api/client';

interface Props {
  patientId: number;
  appointment?: Appointment;
  onClose: () => void;
  onSaved: (appointment: Appointment) => void;
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const TOUCH_BASE_PRESETS: { label: string; weeks?: number; months?: number }[] = [
  { label: '1 week', weeks: 1 },
  { label: '2 weeks', weeks: 2 },
  { label: '1 month', months: 1 },
  { label: '2 months', months: 2 },
];

function addFromNow(preset: { weeks?: number; months?: number }): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  if (preset.weeks) d.setDate(d.getDate() + preset.weeks * 7);
  if (preset.months) d.setMonth(d.getMonth() + preset.months);
  return d;
}

export function AppointmentModal({ patientId, appointment, onClose, onSaved }: Props) {
  const isEdit = !!appointment;
  const [scheduledFor, setScheduledFor] = useState(
    appointment ? toLocalInputValue(appointment.scheduledFor) : '',
  );
  const [reason, setReason] = useState(appointment?.reason ?? '');
  const [notes, setNotes] = useState(appointment?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!scheduledFor) {
      setError('Pick a date and time');
      return;
    }

    setLoading(true);
    try {
      const isoScheduledFor = new Date(scheduledFor).toISOString();
      const saved = isEdit
        ? await updateAppointment(patientId, appointment!.id, {
            scheduledFor: isoScheduledFor,
            reason: reason.trim() || null,
            notes: notes.trim() || null,
          })
        : await createAppointment(patientId, {
            scheduledFor: isoScheduledFor,
            reason: reason.trim() || null,
            notes: notes.trim() || null,
          });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save appointment.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={isEdit ? 'Reschedule Appointment' : 'Schedule Appointment'}
      subtitle={isEdit ? 'Update the date, time, or reason' : 'Book a new appointment for this patient'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

        <div className="field">
          <label>Touch base in…</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TOUCH_BASE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setScheduledFor(toLocalInputValue(addFromNow(preset).toISOString()))}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="apt-when">Date &amp; time</label>
          <input
            id="apt-when"
            type="datetime-local"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="apt-reason">Reason</label>
          <input
            id="apt-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Follow-up checkup"
          />
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="apt-notes">Notes (optional)</label>
          <input
            id="apt-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Internal notes"
          />
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving…' : isEdit ? 'Save changes' : 'Schedule appointment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
