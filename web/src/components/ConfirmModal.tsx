import { useState } from 'react';
import { Modal } from './Modal';
import { ApiError } from '../api/client';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function ConfirmModal({ title, message, confirmLabel = 'Confirm', onClose, onConfirm }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setError(null);
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      {error && <div className="form-error">{error}</div>}
      <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)', margin: '0 0 18px' }}>{message}</p>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Never mind</button>
        <button type="button" className="btn btn-danger" disabled={loading} onClick={handleConfirm}>
          {loading ? 'Please wait…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
