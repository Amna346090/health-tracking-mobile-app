import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from './Modal';
import { createTestRequest, updateTestRequest } from '../api/testRequests';
import type { TestRequest } from '../api/testRequests';
import { ApiError } from '../api/client';

interface Props {
  patientId: number;
  testRequest?: TestRequest;
  onClose: () => void;
  onSaved: (testRequest: TestRequest) => void;
}

export function TestRequestModal({ patientId, testRequest, onClose, onSaved }: Props) {
  const isEdit = !!testRequest;
  const [name, setName] = useState(testRequest?.name ?? '');
  const [instructions, setInstructions] = useState(testRequest?.instructions ?? '');
  const [dueDate, setDueDate] = useState(testRequest ? testRequest.dueDate.slice(0, 10) : '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !dueDate) {
      setError('Name and due date are required');
      return;
    }

    setLoading(true);
    try {
      const saved = isEdit
        ? await updateTestRequest(patientId, testRequest!.id, {
            name: name.trim(),
            instructions: instructions.trim() || null,
            dueDate,
          })
        : await createTestRequest(patientId, {
            name: name.trim(),
            instructions: instructions.trim() || null,
            dueDate,
          });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save test/scan request.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={isEdit ? 'Edit Test/Scan Request' : 'Request Test/Scan'}
      subtitle={isEdit ? 'Update the details of this request' : 'Ask this patient to submit a test or scan'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

        <div className="field">
          <label htmlFor="tr-name">Test/scan name</label>
          <input
            id="tr-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Blood Panel, Chest X-Ray"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="tr-instructions">Instructions (optional)</label>
          <input
            id="tr-instructions"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g. Fasting required"
          />
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="tr-due">Due date</label>
          <input
            id="tr-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving…' : isEdit ? 'Save changes' : 'Request test/scan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
