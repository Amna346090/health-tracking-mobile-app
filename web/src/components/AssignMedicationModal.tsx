import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from './Modal';
import { getAllMedications } from '../api/medications';
import type { Medication } from '../api/medications';
import { createAssignment } from '../api/assignments';
import type { MedicationAssignment } from '../api/assignments';
import { ApiError } from '../api/client';

const FREQUENCIES = ['Once daily', 'Twice daily', 'Three times daily', 'As needed', 'Weekly'];

const FREQUENCY_TIMES_PER_DAY: Record<string, number | ''> = {
  'Once daily': 1,
  'Twice daily': 2,
  'Three times daily': 3,
  'As needed': '',
  'Weekly': '',
};

interface Props {
  patientId: number;
  onClose: () => void;
  onAssigned: (assignment: MedicationAssignment) => void;
}

export function AssignMedicationModal({ patientId, onClose, onAssigned }: Props) {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [medicationId, setMedicationId] = useState('');
  const [frequency, setFrequency] = useState(FREQUENCIES[0]);
  const [timesPerDay, setTimesPerDay] = useState<string>(String(FREQUENCY_TIMES_PER_DAY[FREQUENCIES[0]]));
  const [timesOfDay, setTimesOfDay] = useState('08:00');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [refillsAllowed, setRefillsAllowed] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getAllMedications().then(setMedications).catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!medicationId) {
      setError('Choose a peptide');
      return;
    }

    setLoading(true);
    try {
      const parsedTimesPerDay = timesPerDay.trim() ? parseInt(timesPerDay.trim(), 10) : undefined;
      const parsedRefills = refillsAllowed.trim() ? parseInt(refillsAllowed.trim(), 10) : undefined;
      const assignment = await createAssignment(patientId, {
        medicationId: Number(medicationId),
        frequency,
        timesPerDay: parsedTimesPerDay && !isNaN(parsedTimesPerDay) ? parsedTimesPerDay : undefined,
        timesOfDay: timesOfDay.split(',').map((t) => t.trim()).filter(Boolean),
        startDate,
        endDate: endDate.trim() || null,
        refillsAllowed: parsedRefills && !isNaN(parsedRefills) ? parsedRefills : undefined,
      });
      onAssigned(assignment);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not assign peptide.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Assign Peptide" subtitle="Add a peptide to this patient's schedule" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

        <div className="field">
          <label htmlFor="asn-medication">Peptide</label>
          <select id="asn-medication" value={medicationId} onChange={(e) => setMedicationId(e.target.value)} required>
            <option value="">Select a peptide…</option>
            {medications.map((m) => (
              <option key={m.id} value={m.id}>{m.dosage ? `${m.name} · ${m.dosage}` : m.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="asn-frequency">Frequency</label>
            <select
              id="asn-frequency"
              value={frequency}
              onChange={(e) => {
                setFrequency(e.target.value);
                setTimesPerDay(String(FREQUENCY_TIMES_PER_DAY[e.target.value] ?? ''));
              }}
            >
              {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="asn-timesPerDay">Times per day</label>
            <input
              id="asn-timesPerDay"
              type="number"
              min={0}
              value={timesPerDay}
              onChange={(e) => setTimesPerDay(e.target.value)}
              placeholder="e.g. 2"
            />
          </div>
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
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="asn-end">End date (optional)</label>
            <input id="asn-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="asn-refills">Refills allowed (optional)</label>
          <input
            id="asn-refills"
            type="number"
            min={0}
            value={refillsAllowed}
            onChange={(e) => setRefillsAllowed(e.target.value)}
            placeholder="e.g. 3"
          />
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Assigning…' : 'Assign peptide'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
