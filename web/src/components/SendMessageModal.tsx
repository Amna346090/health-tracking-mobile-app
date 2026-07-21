import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from './Modal';
import { sendMessage } from '../api/messages';
import type { Message } from '../api/messages';
import { ApiError } from '../api/client';

interface Props {
  patientId: number;
  onClose: () => void;
  onSent: (message: Message) => void;
}

export function SendMessageModal({ patientId, onClose, onSent }: Props) {
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!body.trim()) {
      setError('Write a message first');
      return;
    }

    setLoading(true);
    try {
      const message = await sendMessage(patientId, body.trim());
      onSent(message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send message.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Send Message" subtitle="This is delivered as a push notification on the patient's app" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="msg-body">Message</label>
          <textarea
            id="msg-body"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type a note to send to this patient…"
          />
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Sending…' : 'Send message'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
