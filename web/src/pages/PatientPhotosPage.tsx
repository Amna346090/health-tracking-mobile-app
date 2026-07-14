import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getPatientById } from '../api/patients';
import type { PatientRow } from '../api/patients';
import { getPhotos } from '../api/photos';
import type { Photo } from '../api/photos';

export function PatientPhotosPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const pid = Number(patientId);

  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getPatientById(pid), getPhotos(pid)])
      .then(([p, ph]) => { setPatient(p); setPhotos(ph); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pid]);

  if (loading) return <div className="empty-state">Loading…</div>;

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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
