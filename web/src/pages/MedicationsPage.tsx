import { useEffect, useState } from 'react';
import { Plus, Pill, Trash2 } from 'lucide-react';
import { getAllMedications, deleteMedication } from '../api/medications';
import type { Medication } from '../api/medications';
import { AddMedicationModal } from '../components/AddMedicationModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { Spinner } from '../components/Spinner';
import { useAuth } from '../context/AuthContext';

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
  const [deleteTarget, setDeleteTarget] = useState<Medication | null>(null);

  function load() {
    setLoading(true);
    getAllMedications().then(setMedications).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Catalog</p>
          <h1 className="page-title">Peptides</h1>
          <p className="page-subtitle">{medications.length} peptide{medications.length !== 1 ? 's' : ''} in the catalog</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={16} strokeWidth={2.2} />
          Add Peptide
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : medications.length === 0 ? (
        <div className="empty-state">No peptides yet. Add one to get started.</div>
      ) : (
        <div className="card-list">
          {medications.map((m) => (
            <div key={m.id} className="row">
              <div className="avatar" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                <Pill size={17} strokeWidth={2.2} />
              </div>
              <div className="row-body">
                <div className="row-name">{m.dosage ? `${m.name} · ${m.dosage}` : m.name}</div>
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
                    onClick={() => setDeleteTarget(m)}
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

      {deleteTarget && (
        <ConfirmModal
          title="Delete Peptide"
          message={`Delete ${deleteTarget.dosage ? `${deleteTarget.name} · ${deleteTarget.dosage}` : deleteTarget.name}? This cannot be undone.`}
          confirmLabel="Delete peptide"
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await deleteMedication(deleteTarget.id);
            setMedications((prev) => prev.filter((m) => m.id !== deleteTarget.id));
          }}
        />
      )}
    </div>
  );
}
