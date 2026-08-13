import { useEffect, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Modal } from './Modal';
import { getPatientCredentials } from '../api/patients';
import type { PatientCredentials } from '../api/patients';
import { ApiError } from '../api/client';
import { Spinner } from './Spinner';

interface Props {
  patientId: number;
  patientName: string;
  onClose: () => void;
  onResetPassword: () => void;
}

export function PatientCredentialsModal({ patientId, patientName, onClose, onResetPassword }: Props) {
  const [credentials, setCredentials] = useState<PatientCredentials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getPatientCredentials(patientId)
      .then(setCredentials)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load credentials.'))
      .finally(() => setLoading(false));
  }, [patientId]);

  function handleCopy() {
    if (!credentials) return;
    const text = credentials.password
      ? `Username: ${credentials.identifier}\nPassword: ${credentials.password}`
      : `Username: ${credentials.identifier}`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Modal title="Login Credentials" subtitle={`Auto-generated sign-in details for ${patientName}`} onClose={onClose}>
      {loading && <Spinner />}
      {error && <div className="form-error">{error}</div>}

      {!loading && !error && credentials && (
        <>
          <div className="field">
            <label>Username / email</label>
            <input value={credentials.identifier ?? '—'} readOnly />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Password</label>
            {credentials.password ? (
              <input value={credentials.password} readOnly />
            ) : (
              <div className="form-error" style={{ margin: 0 }}>Not available — reset the password to set one.</div>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onResetPassword}>
              Reset password
            </button>
            {credentials.password && (
              <button type="button" className="btn btn-primary" onClick={handleCopy}>
                {copied ? <Check size={14} strokeWidth={2.4} /> : <Copy size={14} strokeWidth={2.4} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
