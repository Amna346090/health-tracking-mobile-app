import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from './Modal';
import { getAllMedications } from '../api/medications';
import type { Medication } from '../api/medications';
import { createAssignment } from '../api/assignments';
import type { MedicationAssignment } from '../api/assignments';
import { ApiError } from '../api/client';

const FREQUENCIES = ['Once daily', 'Twice daily', 'Three times daily', 'As needed', 'Weekly'];

interface Props {
  patientId: number;
  onClose: () => void;
  onAssigned: (assignment: MedicationAssignment) => void;
}

export function AssignMedicationModal({ patientId, onClose, onAssigned }: Props) {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [medicationId, setMedicationId] = useState('');
  const [frequency, setFrequency] = useState(FREQUENCIES[0]);
  const [timesOfDay, setTimesOfDay] = useState('08:00');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getAllMedications().then(setMedications).catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!medicationId) {
      setError('Choose a medication');
      return;
    }

    setLoading(true);
    try {
      const assignment = await createAssignment(patientId, {
        medicationId: Number(medicationId),
        frequency,
        timesOfDay: timesOfDay.split(',').map((t) => t.trim()).filter(Boolean),
        startDate,
        endDate: endDate.trim() || null,
      });
      onAssigned(assignment);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not assign medication.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Assign Medication" subtitle="Add a medication to this patient's schedule" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

        <div className="field">
          <label htmlFor="asn-medication">Medication</label>
          <select id="asn-medication" value={medicationId} onChange={(e) => setMedicationId(e.target.value)} required>
            <option value="">Select a medication…</option>
            {medications.map((m) => (
              <option key={m.id} value={m.id}>{m.name} · {m.dosage}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="asn-frequency">Frequency</label>
          <select id="asn-frequency" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        <div className="field">
          <label htmlFor="asn-times">Times of day</label>
          <input
            id="asn-times"
            value={timesOfDay}
            onChange={(e) => setTimesOfDay(e.target.value)}
            placeholder="e.g. 08:00, 20:00"
          />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="asn-start">Start date</label>
            <input id="asn-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </div>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label htmlFor="asn-end">End date (optional)</label>
            <input id="asn-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Assigning…' : 'Assign medication'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
