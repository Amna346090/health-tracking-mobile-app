import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from './Modal';
import { updateProvider } from '../api/providers';
import type { Provider } from '../api/providers';
import { ApiError } from '../api/client';

interface Props {
  provider: Provider;
  onClose: () => void;
  onSaved: (provider: Provider) => void;
}

export function EditProviderModal({ provider, onClose, onSaved }: Props) {
  const [npi, setNpi] = useState(provider.npi ?? '');
  const [credentials, setCredentials] = useState(provider.credentials ?? '');
  const [specialty, setSpecialty] = useState(provider.specialty ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const updated = await updateProvider(provider.id, {
        npi: npi.trim() || null,
        credentials: credentials.trim() || null,
        specialty: specialty.trim() || null,
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update provider info.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="Provider Info"
      subtitle={`${provider.user.firstName} ${provider.user.lastName}'s credentials`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

        <div className="field">
          <label htmlFor="prov-npi">NPI number</label>
          <input id="prov-npi" value={npi} onChange={(e) => setNpi(e.target.value)} placeholder="e.g. 1234567890" />
        </div>

        <div className="field">
          <label htmlFor="prov-credentials">Credentials</label>
          <input id="prov-credentials" value={credentials} onChange={(e) => setCredentials(e.target.value)} placeholder="e.g. MD, NP, PA-C" />
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="prov-specialty">Specialty</label>
          <input id="prov-specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="e.g. Family Medicine" />
        </div>

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
