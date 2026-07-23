import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import { getAllMedications } from '../api/medications';
import type { Medication } from '../api/medications';

export type MedicationSelection =
  | { type: 'existing'; medication: Medication }
  | { type: 'new'; name: string };

interface Props {
  id?: string;
  value: MedicationSelection | null;
  onChange: (value: MedicationSelection | null) => void;
}

export function MedicationCombobox({ id, value, onChange }: Props) {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [query, setQuery] = useState(value ? labelFor(value) : '');
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getAllMedications().then(setMedications).catch(() => {});
    return () => {
      if (blurTimeout.current) clearTimeout(blurTimeout.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function updateRect() {
      const el = inputRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    updateRect();
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const matches = q ? medications.filter((m) => m.name.toLowerCase().includes(q)) : medications;
  const exactMatch = medications.some((m) => m.name.toLowerCase() === q);

  function selectExisting(m: Medication) {
    setQuery(m.name);
    onChange({ type: 'existing', medication: m });
    setOpen(false);
  }

  function selectNew() {
    const name = query.trim();
    if (!name) return;
    onChange({ type: 'new', name });
    setOpen(false);
  }

  function handleInputChange(next: string) {
    setQuery(next);
    setOpen(true);
    if (!next.trim()) {
      onChange(null);
    }
  }

  return (
    <div className="combobox">
      <input
        id={id}
        ref={inputRef}
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimeout.current = setTimeout(() => setOpen(false), 120);
        }}
        placeholder="Search or add a medication…"
      />
      {open && rect && (matches.length > 0 || q) &&
        createPortal(
          <ul
            className="combobox-dropdown"
            style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {matches.map((m) => (
              <li key={m.id} className="combobox-option" onClick={() => selectExisting(m)}>
                {m.dosage ? `${m.name} · ${m.dosage}` : m.name}
              </li>
            ))}
            {q && !exactMatch && (
              <li className="combobox-option combobox-option-create" onClick={selectNew}>
                <Plus size={13} strokeWidth={2.2} />
                Create "{query.trim()}"
              </li>
            )}
          </ul>,
          document.body,
        )}
    </div>
  );
}

function labelFor(value: MedicationSelection): string {
  return value.type === 'existing' ? value.medication.name : value.name;
}
