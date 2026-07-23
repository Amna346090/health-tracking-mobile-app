import { useEffect, useState } from 'react';
import { Plus, Pill, Trash2 } from 'lucide-react';
import { getAllMedications, deleteMedication } from '../api/medications';
import type { Medication } from '../api/medications';
import { AddMedicationModal } from '../components/AddMedicationModal';
import { Spinner } from '../components/Spinner';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';

const FORM_LABEL: Record<string, string> = {
  TABLET: 'Tablet', CAPSULE: 'Capsule', LIQUID: 'Liquid',
  INJECTION: 'Injection', TOPICAL: 'Topical', OTHER: 'Other',
};

const FOOD_LABEL: Record<string, string> = {
  WITH_FOOD: 'With food', WITHOUT_FOOD: 'Without food', EITHER: 'Either',
};

export function MedicationsPage() {
  const { user } = useAuth();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    getAllMedications().then(setMedications).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleDelete(med: Medication) {
    const confirmed = window.confirm(`Delete ${med.name} · ${med.dosage}? This cannot be undone.`);
    if (!confirmed) return;

    setError(null);
    setDeletingId(med.id);
    try {
      await deleteMedication(med.id);
      setMedications((prev) => prev.filter((m) => m.id !== med.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete this medication.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Catalog</p>
          <h1 className="page-title">Medications</h1>
          <p className="page-subtitle">{medications.length} medication{medications.length !== 1 ? 's' : ''} in the catalog</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={16} strokeWidth={2.2} />
          Add Medication
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <Spinner />
      ) : medications.length === 0 ? (
        <div className="empty-state">No medications yet. Add one to get started.</div>
      ) : (
        <div className="card-list">
          {medications.map((m) => (
            <div key={m.id} className="row" style={{ opacity: deletingId === m.id ? 0.4 : 1 }}>
              <div className="avatar" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                <Pill size={17} strokeWidth={2.2} />
              </div>
              <div className="row-body">
                <div className="row-name">{m.name} · {m.dosage}</div>
                <div className="row-sub">
                  {[
                    m.form && FORM_LABEL[m.form],
                    m.quantityPerDose && `${m.quantityPerDose} per dose`,
                    m.foodInstruction && FOOD_LABEL[m.foodInstruction],
                  ].filter(Boolean).join(' · ') || 'No dosing details set'}
                </div>
              </div>
              <span className="badge badge-staff">{m._count.assignments} active</span>
              {user?.role === 'ADMIN' && (
                <div className="row-actions">
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(m)}
                    disabled={deletingId === m.id}
                  >
                    <Trash2 size={13} strokeWidth={2.2} />
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddMedicationModal
          onClose={() => setShowAdd(false)}
          onCreated={(med) => { setMedications((prev) => [med, ...prev]); setShowAdd(false); }}
        />
      )}
    </div>
  );
}
