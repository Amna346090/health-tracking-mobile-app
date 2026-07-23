import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight, UserPlus, Trash2 } from 'lucide-react';
import { getAllPatients } from '../api/patients';
import type { PatientRow } from '../api/patients';
import { getAllProviders } from '../api/providers';
import type { Provider } from '../api/providers';
import { deleteUser } from '../api/users';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/Avatar';
import { AddPatientModal } from '../components/AddPatientModal';
import { ConfirmModal } from '../components/ConfirmModal';
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
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerFilter, setProviderFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PatientRow | null>(null);

  useEffect(() => {
    if (isAdmin) getAllProviders().then(setProviders).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    setLoading(true);
    getAllPatients(providerFilter ? Number(providerFilter) : undefined)
      .then(setPatients)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [providerFilter]);

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

      <div className="filter-bar">
        <div className="search-wrap" style={{ flex: 1, marginBottom: 0 }}>
          <Search size={16} strokeWidth={2} />
          <input
            className="search-input"
            placeholder="Search patients…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {isAdmin && (
          <select className="select-filter" value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)}>
            <option value="">All providers</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.user.firstName} {p.user.lastName}'s panel</option>
            ))}
          </select>
        )}
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
              {isAdmin && (
                <div className="row-actions">
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={(e: MouseEvent) => { e.stopPropagation(); setDeleteTarget(p); }}
                  >
                    <Trash2 size={13} strokeWidth={2.2} />
                    Delete
                  </button>
                </div>
              )}
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

      {deleteTarget && (
        <ConfirmModal
          title="Delete Patient"
          message={`Delete ${deleteTarget.user.firstName} ${deleteTarget.user.lastName}? This permanently removes their account and all associated health data (logs, medications, photos, documents). This cannot be undone.`}
          confirmLabel="Delete patient"
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await deleteUser(deleteTarget.user.id);
            setPatients((prev) => prev.filter((row) => row.id !== deleteTarget.id));
          }}
        />
      )}
    </div>
  );
}
