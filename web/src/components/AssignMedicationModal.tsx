import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { Modal } from './Modal';
import { getAllMedications } from '../api/medications';
import type { Medication } from '../api/medications';
import { createAssignment, updateAssignment } from '../api/assignments';
import type { MedicationAssignment } from '../api/assignments';
import { ApiError } from '../api/client';

const FREQUENCIES = ['Once daily', 'Twice daily', 'Three times daily', 'As needed', 'Weekly'];

// Default number of time slots shown when a frequency is picked — the doctor can still
// add/remove slots afterward; "times per day" is always just however many are left, never
// a separately-typed number that could disagree with the actual times entered.
const FREQUENCY_DEFAULT_COUNT: Record<string, number> = {
  'Once daily': 1,
  'Twice daily': 2,
  'Three times daily': 3,
  'As needed': 0,
  'Weekly': 1,
};

function timesForCount(current: string[], count: number): string[] {
  if (count <= current.length) return current.slice(0, count);
  return [...current, ...Array(count - current.length).fill('08:00')];
}

interface Props {
  patientId: number;
  /** When set, edits this existing assignment instead of creating a new one. */
  editingAssignment?: MedicationAssignment;
  onClose: () => void;
  onSaved: (assignment: MedicationAssignment) => void;
}

export function AssignMedicationModal({ patientId, editingAssignment, onClose, onSaved }: Props) {
  const isEditing = !!editingAssignment;
  const [medications, setMedications] = useState<Medication[]>([]);
  const [medicationId, setMedicationId] = useState('');
  const [frequency, setFrequency] = useState(editingAssignment?.frequency ?? FREQUENCIES[0]);
  const [times, setTimes] = useState<string[]>(
    editingAssignment?.timesOfDay.length
      ? editingAssignment.timesOfDay
      : timesForCount([], FREQUENCY_DEFAULT_COUNT[editingAssignment?.frequency ?? FREQUENCIES[0]] ?? 0),
  );
  const [startDate, setStartDate] = useState(editingAssignment?.startDate.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(editingAssignment?.endDate?.slice(0, 10) ?? '');
  const [refillsAllowed, setRefillsAllowed] = useState(editingAssignment?.refillsAllowed?.toString() ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isEditing) getAllMedications().then(setMedications).catch(() => {});
  }, [isEditing]);

  function handleFrequencyChange(f: string) {
    setFrequency(f);
    setTimes((prev) => timesForCount(prev, FREQUENCY_DEFAULT_COUNT[f] ?? prev.length));
  }

  function addTime() {
    setTimes((prev) => [...prev, '08:00']);
  }

  function removeTime(index: number) {
    setTimes((prev) => prev.filter((_, i) => i !== index));
  }

  function updateTime(index: number, value: string) {
    setTimes((prev) => prev.map((t, i) => (i === index ? value : t)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isEditing && !medicationId) {
      setError('Choose a peptide');
      return;
    }

    setLoading(true);
    try {
      const parsedRefills = refillsAllowed.trim() ? parseInt(refillsAllowed.trim(), 10) : undefined;
      const validTimes = times.filter(Boolean);
      const scheduleFields = {
        frequency,
        timesPerDay: validTimes.length || undefined,
        timesOfDay: validTimes,
        startDate,
        endDate: endDate.trim() || null,
        refillsAllowed: parsedRefills && !isNaN(parsedRefills) ? parsedRefills : undefined,
      };

      const assignment = isEditing
        ? await updateAssignment(patientId, editingAssignment.id, scheduleFields)
        : await createAssignment(patientId, { medicationId: Number(medicationId), ...scheduleFields });
      onSaved(assignment);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not ${isEditing ? 'update' : 'assign'} peptide.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={isEditing ? 'Edit Peptide' : 'Assign Peptide'}
      subtitle={isEditing ? 'Update this peptide\'s schedule' : "Add a peptide to this patient's schedule"}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

        <div className="field">
          <label htmlFor="asn-medication">Peptide</label>
          {isEditing ? (
            <div className="info-item-value" style={{ padding: '10px 0' }}>
              {editingAssignment.medication.dosage
                ? `${editingAssignment.medication.name} · ${editingAssignment.medication.dosage}`
                : editingAssignment.medication.name}
            </div>
          ) : (
            <select id="asn-medication" value={medicationId} onChange={(e) => setMedicationId(e.target.value)} required>
              <option value="">Select a peptide…</option>
              {medications.map((m) => (
                <option key={m.id} value={m.id}>{m.dosage ? `${m.name} · ${m.dosage}` : m.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="field">
          <label htmlFor="asn-frequency">Frequency</label>
          <select
            id="asn-frequency"
            value={frequency}
            onChange={(e) => handleFrequencyChange(e.target.value)}
          >
            {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Times per day — {times.length} {times.length === 1 ? 'time' : 'times'}</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {times.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="time"
                  value={t}
                  onChange={(e) => updateTime(i, e.target.value)}
                  style={{ flex: 1 }}
                  required
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => removeTime(i)}
                  aria-label="Remove this time"
                >
                  <X size={13} strokeWidth={2.2} />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary btn-sm" onClick={addTime} style={{ alignSelf: 'flex-start' }}>
              <Plus size={13} strokeWidth={2.2} />
              Add time
            </button>
          </div>
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
            {loading ? 'Saving…' : isEditing ? 'Save changes' : 'Assign peptide'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
