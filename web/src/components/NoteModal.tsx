import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from './Modal';
import { createNote, updateNote } from '../api/notes';
import type { Note } from '../api/notes';
import { ApiError } from '../api/client';

interface Props {
  patientId: number;
  editingNote?: Note;
  onClose: () => void;
  onSaved: (note: Note) => void;
}

export function NoteModal({ patientId, editingNote, onClose, onSaved }: Props) {
  const isEditing = !!editingNote;
  const [body, setBody] = useState(editingNote?.body ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!body.trim()) {
      setError('Write a note first');
      return;
    }

    setLoading(true);
    try {
      const saved = isEditing
        ? await updateNote(patientId, editingNote.id, body.trim())
        : await createNote(patientId, body.trim());
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not ${isEditing ? 'update' : 'add'} note.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={isEditing ? 'Edit Note' : 'Add Note'}
      subtitle="Internal note — visible to staff/admin only, never shown to the patient"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="note-body">Note</label>
          <textarea
            id="note-body"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="e.g. Paid for this month, prefers evening calls…"
            autoFocus
          />
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving…' : isEditing ? 'Save changes' : 'Add note'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
