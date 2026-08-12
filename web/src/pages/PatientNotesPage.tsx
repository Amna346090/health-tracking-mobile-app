import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, StickyNote, Pencil, Plus, Trash2 } from 'lucide-react';
import { getPatientById } from '../api/patients';
import type { PatientRow } from '../api/patients';
import { getNotes, deleteNote } from '../api/notes';
import type { Note } from '../api/notes';
import { NoteModal } from '../components/NoteModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { Spinner } from '../components/Spinner';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export function PatientNotesPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const pid = Number(patientId);

  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteModal, setNoteModal] = useState<'new' | Note | null>(null);
  const [deletingNote, setDeletingNote] = useState<Note | null>(null);

  useEffect(() => {
    Promise.all([getPatientById(pid), getNotes(pid)])
      .then(([p, n]) => { setPatient(p); setNotes(n); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pid]);

  if (loading) return <Spinner />;

  const name = patient ? `${patient.user.firstName} ${patient.user.lastName}` : 'Patient';

  return (
    <div className="page">
      <div className="page-header">
        <button className="back-link" onClick={() => navigate(`/patients/${pid}`)}>
          <ArrowLeft size={15} /> Back to {name}
        </button>
      </div>

      <div className="page-header">
        <div>
          <p className="page-eyebrow">Notes</p>
          <h1 className="page-title">{name}</h1>
          <p className="page-subtitle">{notes.length} note{notes.length !== 1 ? 's' : ''} · Staff/admin only</p>
        </div>
        <button className="btn btn-primary" onClick={() => setNoteModal('new')}>
          <Plus size={14} strokeWidth={2.2} />
          Add Note
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="empty-state">No notes yet.</div>
      ) : (
        <div className="card-list">
          {notes.map((note) => (
            <div key={note.id} className="row" style={{ alignItems: 'flex-start' }}>
              <div className="avatar" style={{ background: 'var(--color-primary-bg)', color: 'var(--color-primary)' }}>
                <StickyNote size={16} strokeWidth={2.2} />
              </div>
              <div className="row-body">
                <div className="row-name" style={{ whiteSpace: 'pre-wrap' }}>{note.body}</div>
                <div className="row-sub">
                  {note.author.firstName} {note.author.lastName} · {formatWhen(note.createdAt)}
                  {note.updatedAt !== note.createdAt ? ' (edited)' : ''}
                </div>
              </div>
              <div className="row-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => setNoteModal(note)}>
                  <Pencil size={13} strokeWidth={2.2} />
                  Edit
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => setDeletingNote(note)}>
                  <Trash2 size={13} strokeWidth={2.2} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {noteModal && (
        <NoteModal
          patientId={pid}
          editingNote={noteModal !== 'new' ? noteModal : undefined}
          onClose={() => setNoteModal(null)}
          onSaved={(saved) => {
            setNotes((prev) =>
              prev.some((n) => n.id === saved.id)
                ? prev.map((n) => (n.id === saved.id ? saved : n))
                : [saved, ...prev],
            );
            setNoteModal(null);
          }}
        />
      )}

      {deletingNote && (
        <ConfirmModal
          title="Delete Note"
          message="Remove this note permanently? This cannot be undone."
          confirmLabel="Delete"
          onClose={() => setDeletingNote(null)}
          onConfirm={async () => {
            await deleteNote(pid, deletingNote.id);
            setNotes((prev) => prev.filter((n) => n.id !== deletingNote.id));
          }}
        />
      )}
    </div>
  );
}
