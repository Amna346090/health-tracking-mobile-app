import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from './Modal';
import { resetUserPassword } from '../api/users';
import { ApiError } from '../api/client';

interface Props {
  userId: number;
  userName: string;
  onClose: () => void;
}

export function ResetPasswordModal({ userId, userName, onClose }: Props) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await resetUserPassword(userId, newPassword);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Reset Password" subtitle={`Set a new password for ${userName}`} onClose={onClose}>
      {success ? (
        <>
          <div className="form-error" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
            Password reset successfully.
          </div>
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label htmlFor="resetNewPassword">New password</label>
            <input
              id="resetNewPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              required
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="resetConfirmPassword">Confirm new password</label>
            <input
              id="resetConfirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Resetting…' : 'Reset password'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
