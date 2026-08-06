import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { getPatientById } from '../api/patients';
import type { PatientRow } from '../api/patients';
import { getPhotos, deletePhoto } from '../api/photos';
import type { Photo } from '../api/photos';
import { PhotoModal } from '../components/PhotoModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { Spinner } from '../components/Spinner';

export function PatientPhotosPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const pid = Number(patientId);

  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoModal, setPhotoModal] = useState<'new' | Photo | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState<Photo | null>(null);

  useEffect(() => {
    Promise.all([getPatientById(pid), getPhotos(pid)])
      .then(([p, ph]) => { setPatient(p); setPhotos(ph); })
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
          <p className="page-eyebrow">Progress photos</p>
          <h1 className="page-title">{name}</h1>
          <p className="page-subtitle">{photos.length} photo{photos.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setPhotoModal('new')}>
          <Plus size={14} strokeWidth={2.2} />
          Upload Photo
        </button>
      </div>

      {photos.length === 0 ? (
        <div className="empty-state">No progress photos yet.</div>
      ) : (
        <div className="photo-grid">
          {photos.map((photo) => (
            <div key={photo.id} className="photo-tile">
              <img src={photo.url} alt={photo.caption ?? 'Progress photo'} loading="lazy" />
              <div className="photo-tile-info">
                {photo.caption && <div className="photo-tile-caption">{photo.caption}</div>}
                <div className="photo-tile-meta">
                  {new Date(photo.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {' · '}
                  {photo.uploadedBy.firstName} {photo.uploadedBy.lastName}
                </div>
                <div className="row-actions" style={{ marginTop: 8, marginLeft: 0 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setPhotoModal(photo)}>
                    <Pencil size={12} strokeWidth={2.2} />
                    Edit
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => setDeletingPhoto(photo)}>
                    <Trash2 size={12} strokeWidth={2.2} />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {photoModal && (
        <PhotoModal
          patientId={pid}
          editingPhoto={photoModal !== 'new' ? photoModal : undefined}
          onClose={() => setPhotoModal(null)}
          onSaved={(saved) => {
            setPhotos((prev) =>
              prev.some((p) => p.id === saved.id)
                ? prev.map((p) => (p.id === saved.id ? saved : p))
                : [saved, ...prev],
            );
            setPhotoModal(null);
          }}
        />
      )}

      {deletingPhoto && (
        <ConfirmModal
          title="Delete Photo"
          message="Remove this photo permanently? This cannot be undone."
          confirmLabel="Delete"
          onClose={() => setDeletingPhoto(null)}
          onConfirm={async () => {
            await deletePhoto(deletingPhoto.id);
            setPhotos((prev) => prev.filter((p) => p.id !== deletingPhoto.id));
          }}
        />
      )}
    </div>
  );
}
