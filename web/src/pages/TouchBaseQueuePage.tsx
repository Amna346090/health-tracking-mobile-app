import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartPulse } from 'lucide-react';
import { getTouchBaseQueue, markContacted } from '../api/touchBase';
import type { TouchBaseQueueItem } from '../api/touchBase';
import { getAllProviders } from '../api/providers';
import type { Provider } from '../api/providers';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/Spinner';
import { ApiError } from '../api/client';

function daysSince(iso: string | null): string {
  if (!iso) return 'Never contacted';
  const days = Math.round((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

function formatThresholdDays(days: number): string {
  if (days < 1) return `${Math.round(days * 1440)} min`;
  return `${days} days`;
}

export function TouchBaseQueuePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [queue, setQueue] = useState<TouchBaseQueueItem[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerFilter, setProviderFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [contactingId, setContactingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) getAllProviders().then(setProviders).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    setLoading(true);
    getTouchBaseQueue(providerFilter ? Number(providerFilter) : undefined)
      .then(setQueue)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [providerFilter]);

  async function handleMarkContacted(patientId: number) {
    setError(null);
    setContactingId(patientId);
    try {
      await markContacted(patientId);
      setQueue((prev) => prev.filter((item) => item.id !== patientId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not mark as contacted.');
    } finally {
      setContactingId(null);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Care team</p>
          <h1 className="page-title">Touch-Base Queue</h1>
          <p className="page-subtitle">{queue.length} patient{queue.length !== 1 ? 's' : ''} overdue or nearing their touch-base threshold</p>
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

      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <Spinner />
      ) : queue.length === 0 ? (
        <div className="empty-state">No patients overdue or nearing their touch-base threshold. 🎉</div>
      ) : (
        <div className="card-list">
          {queue.map((item) => (
            <div key={item.id} className="row">
              <div
                className="avatar row-clickable"
                style={{ background: 'var(--color-primary-bg)', color: 'var(--color-primary)' }}
                onClick={() => navigate(`/patients/${item.id}`)}
              >
                <HeartPulse size={16} strokeWidth={2.2} />
              </div>
              <div className="row-body row-clickable" onClick={() => navigate(`/patients/${item.id}`)}>
                <div className="row-name">{item.user.firstName} {item.user.lastName}</div>
                <div className="row-sub">
                  Last contact: {daysSince(item.lastContactAt)} · Threshold: {formatThresholdDays(item.thresholdDays)}
                </div>
              </div>
              <span className={`badge badge-${item.overdue ? 'overdue' : 'nearing'}`}>
                {item.overdue ? 'Overdue' : 'Due Soon'}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                style={{ marginLeft: 10 }}
                disabled={contactingId === item.id}
                onClick={() => handleMarkContacted(item.id)}
              >
                {contactingId === item.id ? 'Saving…' : 'Mark as contacted'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
