import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { getPatientById } from '../api/patients';
import type { PatientRow } from '../api/patients';
import { getDocuments, deleteDocument } from '../api/documents';
import type { Document } from '../api/documents';
import { DocumentModal } from '../components/DocumentModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { Spinner } from '../components/Spinner';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fileTypeLabel(fileType: string): string {
  if (fileType === 'application/pdf') return 'PDF';
  if (fileType.startsWith('image/')) return 'Image';
  if (fileType === 'application/dicom') return 'DICOM';
  return fileType;
}

export function PatientDocumentsPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const pid = Number(patientId);

  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [docModal, setDocModal] = useState<'new' | Document | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<Document | null>(null);

  useEffect(() => {
    Promise.all([getPatientById(pid), getDocuments(pid)])
      .then(([p, d]) => { setPatient(p); setDocuments(d); })
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
          <p className="page-eyebrow">Documents</p>
          <h1 className="page-title">{name}</h1>
          <p className="page-subtitle">{documents.length} document{documents.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setDocModal('new')}>
          <Plus size={14} strokeWidth={2.2} />
          Upload Document
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="empty-state">No documents uploaded yet.</div>
      ) : (
        <div className="card-list">
          {documents.map((doc) => (
            <div key={doc.id} className="row">
              <div className="avatar" style={{ background: 'var(--color-primary-bg)', color: 'var(--color-primary)' }}>
                <FileText size={16} strokeWidth={2.2} />
              </div>
              <div className="row-body">
                <div className="row-name">{doc.tag ?? 'Untagged document'}</div>
                <div className="row-sub">
                  {fileTypeLabel(doc.fileType)} · {formatWhen(doc.uploadedAt)} · {doc.uploadedBy.firstName} {doc.uploadedBy.lastName}
                </div>
              </div>
              {!doc.tag && <span className="badge badge-cancelled">Untagged</span>}
              <div className="row-actions">
                <a href={doc.url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                  View
                </a>
                <button className="btn btn-secondary btn-sm" onClick={() => setDocModal(doc)}>
                  <Pencil size={13} strokeWidth={2.2} />
                  Edit
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => setDeletingDoc(doc)}>
                  <Trash2 size={13} strokeWidth={2.2} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {docModal && (
        <DocumentModal
          patientId={pid}
          editingDocument={docModal !== 'new' ? docModal : undefined}
          onClose={() => setDocModal(null)}
          onSaved={(saved) => {
            setDocuments((prev) =>
              prev.some((d) => d.id === saved.id)
                ? prev.map((d) => (d.id === saved.id ? saved : d))
                : [saved, ...prev],
            );
            setDocModal(null);
          }}
        />
      )}

      {deletingDoc && (
        <ConfirmModal
          title="Delete Document"
          message="Remove this document permanently? This cannot be undone."
          confirmLabel="Delete"
          onClose={() => setDeletingDoc(null)}
          onConfirm={async () => {
            await deleteDocument(deletingDoc.id);
            setDocuments((prev) => prev.filter((d) => d.id !== deletingDoc.id));
          }}
        />
      )}
    </div>
  );
}
