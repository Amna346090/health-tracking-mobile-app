import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight, UserPlus } from 'lucide-react';
import { getAllPatients } from '../api/patients';
import type { PatientRow } from '../api/patients';
import { Avatar } from '../components/Avatar';
import { AddPatientModal } from '../components/AddPatientModal';
import { Spinner } from '../components/Spinner';

function initialsOf(row: PatientRow): string {
  return (row.user.firstName[0] + row.user.lastName[0]).toUpperCase();
}

function ageFromDob(iso: string): number {
  const dob = new Date(iso);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const hadBirthday = now.getMonth() > dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
  if (!hadBirthday) age -= 1;
  return age;
}

export function PatientsPage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    getAllPatients()
      .then(setPatients)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) =>
      `${p.user.firstName} ${p.user.lastName} ${p.user.email}`.toLowerCase().includes(q),
    );
  }, [patients, query]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Care team</p>
          <h1 className="page-title">Patients</h1>
          <p className="page-subtitle">{patients.length} patient{patients.length !== 1 ? 's' : ''} under your care</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <UserPlus size={16} strokeWidth={2.2} />
          Add Patient
        </button>
      </div>

      <div className="search-wrap">
        <Search size={16} strokeWidth={2} />
        <input
          className="search-input"
          placeholder="Search patients…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <div className="empty-state">No patients found.</div>
      ) : (
        <div className="card-list">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="row row-clickable"
              onClick={() => navigate(`/patients/${p.id}`)}
            >
              <Avatar url={p.avatarUrl} initials={initialsOf(p)} />
              <div className="row-body">
                <div className="row-name">{p.user.firstName} {p.user.lastName}</div>
                <div className="row-sub">{p.user.email} · Age {ageFromDob(p.dateOfBirth)}</div>
              </div>
              <div className="chevron"><ChevronRight size={18} /></div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddPatientModal
          onClose={() => setShowAdd(false)}
          onCreated={(patientId) => navigate(`/patients/${patientId}`)}
        />
      )}
    </div>
  );
}
