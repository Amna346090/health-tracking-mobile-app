import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from './Modal';
import { createPatient } from '../api/patients';
import type { Gender } from '../api/patients';
import { ApiError } from '../api/client';

interface Props {
  onClose: () => void;
  onCreated: (patientId: number) => void;
}

export function AddPatientModal({ onClose, onCreated }: Props) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [healthIssue, setHealthIssue] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const result = await createPatient({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
        dateOfBirth,
        gender: gender || undefined,
        healthIssue: healthIssue.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      if (result.patientProfile) onCreated(result.patientProfile.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create patient.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Add Patient" subtitle="Create a new patient record" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="ap-firstName">First name</label>
            <input id="ap-firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="ap-lastName">Last name</label>
            <input id="ap-lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
        </div>

        <div className="field">
          <label htmlFor="ap-email">Email</label>
          <input id="ap-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <div className="field">
          <label htmlFor="ap-password">Initial password</label>
          <input
            id="ap-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 8 characters"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="ap-dob">Date of birth</label>
          <input id="ap-dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="ap-gender">Gender</label>
            <select id="ap-gender" value={gender} onChange={(e) => setGender(e.target.value as Gender | '')}>
              <option value="">—</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
              <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="ap-phone">Phone</label>
            <input id="ap-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="ap-healthIssue">Health issue / condition</label>
          <input
            id="ap-healthIssue"
            value={healthIssue}
            onChange={(e) => setHealthIssue(e.target.value)}
            placeholder="e.g. Type 2 Diabetes"
          />
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating…' : 'Create patient'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
