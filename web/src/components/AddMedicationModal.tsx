import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from './Modal';
import { createMedication } from '../api/medications';
import type { Medication, MedicationForm, FoodInstruction } from '../api/medications';
import { ApiError } from '../api/client';

interface Props {
  onClose: () => void;
  onCreated: (medication: Medication) => void;
}

export function AddMedicationModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [doseAmount, setDoseAmount] = useState('');
  const [doseUnit, setDoseUnit] = useState('');
  const [form, setForm] = useState<MedicationForm | ''>('');
  const [quantityPerDose, setQuantityPerDose] = useState('');
  const [foodInstruction, setFoodInstruction] = useState<FoodInstruction | ''>('');
  const [instructions, setInstructions] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const quantity = quantityPerDose.trim() ? parseInt(quantityPerDose.trim(), 10) : undefined;
      const amount = doseAmount.trim() ? parseFloat(doseAmount.trim()) : undefined;
      const med = await createMedication({
        name: name.trim(),
        dosage: dosage.trim(),
        doseAmount: amount && !isNaN(amount) ? amount : undefined,
        doseUnit: doseUnit.trim() || undefined,
        form: form || undefined,
        quantityPerDose: quantity && !isNaN(quantity) ? quantity : undefined,
        foodInstruction: foodInstruction || undefined,
        instructions: instructions.trim() || undefined,
      });
      onCreated(med);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create medication.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Add Medication" subtitle="Create a new catalog entry" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

        <div className="field">
          <label htmlFor="am-name">Name</label>
          <input id="am-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Metformin" required />
        </div>

        <div className="field">
          <label htmlFor="am-dosage">Dosage</label>
          <input id="am-dosage" value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="e.g. 500mg" required />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="am-doseAmount">Dose amount</label>
            <input
              id="am-doseAmount"
              type="number"
              step="any"
              min={0}
              value={doseAmount}
              onChange={(e) => setDoseAmount(e.target.value)}
              placeholder="e.g. 500"
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="am-doseUnit">Dose unit</label>
            <input id="am-doseUnit" value={doseUnit} onChange={(e) => setDoseUnit(e.target.value)} placeholder="e.g. mg" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="am-form">Form</label>
            <select id="am-form" value={form} onChange={(e) => setForm(e.target.value as MedicationForm | '')}>
              <option value="">—</option>
              <option value="TABLET">Tablet</option>
              <option value="CAPSULE">Capsule</option>
              <option value="LIQUID">Liquid</option>
              <option value="INJECTION">Injection</option>
              <option value="TOPICAL">Topical</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="am-qty">Quantity per dose</label>
            <input
              id="am-qty"
              type="number"
              min={1}
              value={quantityPerDose}
              onChange={(e) => setQuantityPerDose(e.target.value)}
              placeholder="e.g. 2"
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="am-food">Food instruction</label>
          <select id="am-food" value={foodInstruction} onChange={(e) => setFoodInstruction(e.target.value as FoodInstruction | '')}>
            <option value="">—</option>
            <option value="WITH_FOOD">With food</option>
            <option value="WITHOUT_FOOD">Without food</option>
            <option value="EITHER">Either</option>
          </select>
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="am-instructions">Instructions</label>
          <textarea
            id="am-instructions"
            rows={2}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g. Take with water in the morning"
          />
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating…' : 'Create medication'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
