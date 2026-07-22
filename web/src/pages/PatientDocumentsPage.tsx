import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Tag } from 'lucide-react';
import { getPatientById } from '../api/patients';
import type { PatientRow } from '../api/patients';
import { getDocuments } from '../api/documents';
import type { Document } from '../api/documents';
import { DocumentTagModal } from '../components/DocumentTagModal';
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
  const [tagging, setTagging] = useState<Document | null>(null);

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
                <button className="btn btn-secondary btn-sm" onClick={() => setTagging(doc)}>
                  <Tag size={13} strokeWidth={2.2} />
                  Edit tag
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tagging && (
        <DocumentTagModal
          patientId={pid}
          document={tagging}
          onClose={() => setTagging(null)}
          onSaved={(updated) => {
            setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
            setTagging(null);
          }}
        />
      )}
    </div>
  );
}
