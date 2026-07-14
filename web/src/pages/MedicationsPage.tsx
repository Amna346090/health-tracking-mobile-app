import { useEffect, useState } from 'react';
import { Plus, Pill } from 'lucide-react';
import { getAllMedications } from '../api/medications';
import type { Medication } from '../api/medications';
import { AddMedicationModal } from '../components/AddMedicationModal';
import { Spinner } from '../components/Spinner';

const FORM_LABEL: Record<string, string> = {
  TABLET: 'Tablet', CAPSULE: 'Capsule', LIQUID: 'Liquid',
  INJECTION: 'Injection', TOPICAL: 'Topical', OTHER: 'Other',
};

const FOOD_LABEL: Record<string, string> = {
  WITH_FOOD: 'With food', WITHOUT_FOOD: 'Without food', EITHER: 'Either',
};

export function MedicationsPage() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

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
          <h1 className="page-title">Medications</h1>
          <p className="page-subtitle">{medications.length} medication{medications.length !== 1 ? 's' : ''} in the catalog</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={16} strokeWidth={2.2} />
          Add Medication
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : medications.length === 0 ? (
        <div className="empty-state">No medications yet. Add one to get started.</div>
      ) : (
        <div className="card-list">
          {medications.map((m) => (
            <div key={m.id} className="row">
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
