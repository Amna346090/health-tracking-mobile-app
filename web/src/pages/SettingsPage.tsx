import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { getTouchBaseSettings, updateTouchBaseSettings } from '../api/touchBase';
import { Spinner } from '../components/Spinner';
import { ApiError } from '../api/client';

const PRESETS = [
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
  { label: '2 months', days: 60 },
  { label: '3 months', days: 90 },
];

export function SettingsPage() {
  const [days, setDays] = useState('30');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTouchBaseSettings()
      .then((s) => setDays(String(s.defaultThresholdDays)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const parsed = parseInt(days, 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
      setError('Enter a positive number of days');
      return;
    }
    setSaving(true);
    try {
      await updateTouchBaseSettings(parsed);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Administration</p>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Global defaults for the CRM</p>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Touch-Base Threshold</h2>
        <div className="card">
          <form onSubmit={handleSubmit}>
            {error && <div className="form-error">{error}</div>}
            {saved && (
              <div style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)', borderRadius: 'var(--radius-sm)', padding: '11px 14px', fontSize: 13, fontWeight: 500, marginBottom: 16 }}>
                Saved.
              </div>
            )}

            <div className="field">
              <label>Default threshold</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className={`btn btn-sm ${Number(days) === preset.days ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setDays(String(preset.days))}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={1}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                style={{ maxWidth: 160 }}
                placeholder="Custom days"
              />
              <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 8 }}>
                Applies to any patient without a custom threshold set on their own profile.
              </p>
            </div>

            <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
