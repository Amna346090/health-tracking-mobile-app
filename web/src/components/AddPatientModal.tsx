import { useState } from 'react';
import type { FormEvent } from 'react';
import { Copy, Check } from 'lucide-react';
import { Modal } from './Modal';
import { createPatient } from '../api/patients';
import type { Gender, GeneratedCredentials } from '../api/patients';
import { createMedication } from '../api/medications';
import { createAssignment } from '../api/assignments';
import { MedicationCombobox } from './MedicationCombobox';
import type { MedicationSelection } from './MedicationCombobox';
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
  const [medication, setMedication] = useState<MedicationSelection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [createdPatientId, setCreatedPatientId] = useState<number | null>(null);
  const [credentials, setCredentials] = useState<GeneratedCredentials | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!phone.trim()) {
      setError('Phone number is required');
      return;
    }
    if (password && password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const result = await createPatient({
        firstName: firstName.trim(),
        phone: phone.trim(),
        lastName: lastName.trim() || undefined,
        email: email.trim() ? email.trim().toLowerCase() : undefined,
        password: password || undefined,
        dateOfBirth: dateOfBirth || undefined,
        gender: gender || undefined,
        healthIssue: healthIssue.trim() || undefined,
      });

      if (medication && result.patientProfile) {
        const medicationId =
          medication.type === 'existing'
            ? medication.medication.id
            : (await createMedication({ name: medication.name })).id;

        await createAssignment(result.patientProfile.id, {
          medicationId,
          startDate: new Date().toISOString().slice(0, 10),
        });
      }

      if (result.patientProfile) {
        if (result.generatedCredentials) {
          setCreatedPatientId(result.patientProfile.id);
          setCredentials(result.generatedCredentials);
        } else {
          onCreated(result.patientProfile.id);
        }
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create patient.');
    } finally {
      setLoading(false);
    }
  }

  if (credentials && createdPatientId !== null) {
    return (
      <CredentialsRevealModal
        credentials={credentials}
        onDone={() => onCreated(createdPatientId)}
      />
    );
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
            <label htmlFor="ap-lastName">Last name (optional)</label>
            <input id="ap-lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="ap-phone">Phone</label>
          <input id="ap-phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>

        <div className="field">
          <label htmlFor="ap-email">Email (optional)</label>
          <input
            id="ap-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Leave blank to auto-generate a username"
          />
        </div>

        <div className="field">
          <label htmlFor="ap-password">Initial password (optional)</label>
          <input
            id="ap-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank to auto-generate one"
          />
        </div>

        <div className="field">
          <label htmlFor="ap-dob">Date of birth (optional)</label>
          <input id="ap-dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
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
            <label htmlFor="ap-healthIssue">Health issue</label>
            <input
              id="ap-healthIssue"
              value={healthIssue}
              onChange={(e) => setHealthIssue(e.target.value)}
              placeholder="e.g. Type 2 Diabetes"
            />
          </div>
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="ap-medication">Current medication (optional)</label>
          <MedicationCombobox id="ap-medication" value={medication} onChange={setMedication} />
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

function CredentialsRevealModal({
  credentials,
  onDone,
}: {
  credentials: GeneratedCredentials;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const text = credentials.password
      ? `Username: ${credentials.identifier}\nPassword: ${credentials.password}`
      : `Username: ${credentials.identifier}`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Modal title="Patient Created" subtitle="Save these login details now — they won't be shown again" onClose={onDone}>
      <div className="field">
        <label>Login username</label>
        <input value={credentials.identifier} readOnly />
      </div>
      {credentials.password && (
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Login password</label>
          <input value={credentials.password} readOnly />
        </div>
      )}

      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={handleCopy}>
          {copied ? <Check size={14} strokeWidth={2.4} /> : <Copy size={14} strokeWidth={2.4} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button type="button" className="btn btn-primary" onClick={onDone}>Done</button>
      </div>
    </Modal>
  );
}
