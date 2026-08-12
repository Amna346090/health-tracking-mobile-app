import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from './Modal';
import { updatePatient } from '../api/patients';
import type { PatientRow, Gender } from '../api/patients';
import { getAllProviders } from '../api/providers';
import type { Provider } from '../api/providers';
import { ApiError } from '../api/client';
import { STAFF_FEATURES_ENABLED } from '../config';

interface Props {
  patient: PatientRow;
  onClose: () => void;
  onSaved: (updated: PatientRow) => void;
}

export function EditPatientModal({ patient, onClose, onSaved }: Props) {
  const [firstName, setFirstName] = useState(patient.user.firstName);
  const [lastName, setLastName] = useState(patient.user.lastName);
  const [dateOfBirth, setDateOfBirth] = useState(patient.dateOfBirth?.slice(0, 10) ?? '');
  const [gender, setGender] = useState<Gender | ''>(patient.gender ?? '');
  const [healthIssue, setHealthIssue] = useState(patient.healthIssue ?? '');
  const [phone, setPhone] = useState(patient.phone ?? '');
  const [address, setAddress] = useState(patient.address ?? '');
  const [providerId, setProviderId] = useState(patient.providerId ? String(patient.providerId) : '');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (STAFF_FEATURES_ENABLED) getAllProviders().then(setProviders).catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const updated = await updatePatient(patient.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ...(dateOfBirth && { dateOfBirth }),
        gender: gender || null,
        healthIssue: healthIssue.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        providerId: providerId ? Number(providerId) : null,
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update patient.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Edit Patient" subtitle={`Update ${patient.user.firstName} ${patient.user.lastName}'s info`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="ep-firstName">First name</label>
            <input id="ep-firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="ep-lastName">Last name (optional)</label>
            <input id="ep-lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="ep-dob">Date of birth (optional)</label>
          <input id="ep-dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="ep-gender">Gender</label>
            <select id="ep-gender" value={gender} onChange={(e) => setGender(e.target.value as Gender | '')}>
              <option value="">—</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
              <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="ep-phone">Phone</label>
            <input id="ep-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="ep-healthIssue">Health issue / condition</label>
          <input id="ep-healthIssue" value={healthIssue} onChange={(e) => setHealthIssue(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="ep-address">Address</label>
          <input id="ep-address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>

        {STAFF_FEATURES_ENABLED && (
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="ep-provider">Assigned provider</label>
            <select id="ep-provider" value={providerId} onChange={(e) => setProviderId(e.target.value)}>
              <option value="">— Unassigned (visible to all staff) —</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.user.firstName} {p.user.lastName}</option>
              ))}
            </select>
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
