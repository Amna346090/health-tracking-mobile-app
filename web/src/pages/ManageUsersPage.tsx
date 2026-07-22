import { useEffect, useState } from 'react';
import { Trash2, KeyRound, IdCard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import { deleteUser, getAllUsers } from '../api/users';
import type { ManagedUser } from '../api/users';
import { getAllProviders } from '../api/providers';
import type { Provider } from '../api/providers';
import { ResetPasswordModal } from '../components/ResetPasswordModal';
import { EditProviderModal } from '../components/EditProviderModal';
import { Spinner } from '../components/Spinner';

function badgeClass(role: string): string {
  if (role === 'ADMIN') return 'badge badge-admin';
  if (role === 'STAFF') return 'badge badge-staff';
  return 'badge badge-patient';
}

export function ManageUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);

  function load() {
    setLoading(true);
    Promise.all([getAllUsers(), getAllProviders()])
      .then(([u, p]) => { setUsers(u); setProviders(p); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleDelete(target: ManagedUser) {
    const extra = target.role === 'PATIENT' ? ' and all associated health data' : '';
    const confirmed = window.confirm(
      `Delete ${target.firstName} ${target.lastName}? This permanently removes their account${extra}. This cannot be undone.`,
    );
    if (!confirmed) return;

    setError(null);
    setDeletingId(target.id);
    try {
      await deleteUser(target.id);
      setUsers((prev) => prev.filter((u) => u.id !== target.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete this account.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Administration</p>
          <h1 className="page-title">Manage Users</h1>
          <p className="page-subtitle">{users.length} account{users.length !== 1 ? 's' : ''} in the system</p>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <Spinner />
      ) : users.length === 0 ? (
        <div className="empty-state">No users found.</div>
      ) : (
        <div className="card-list">
          {users.map((u) => {
            const isSelf = u.id === currentUser?.id;
            return (
              <div key={u.id} className="row" style={{ opacity: deletingId === u.id ? 0.4 : 1 }}>
                <div className="avatar">{(u.firstName[0] + u.lastName[0]).toUpperCase()}</div>
                <div className="row-body">
                  <div className="row-name">
                    {u.firstName} {u.lastName}{isSelf && <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}> (you)</span>}
                  </div>
                  <div className="row-sub">{u.email}</div>
                </div>
                <span className={badgeClass(u.role)}>{u.role}</span>
                {!isSelf && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {u.role === 'STAFF' && (() => {
                      const provider = providers.find((p) => p.userId === u.id);
                      return provider ? (
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingProvider(provider)}>
                          <IdCard size={13} strokeWidth={2.2} />
                          Provider Info
                        </button>
                      ) : null;
                    })()}
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setResetTarget(u)}
                    >
                      <KeyRound size={13} strokeWidth={2.2} />
                      Reset Password
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(u)}
                      disabled={deletingId === u.id}
                    >
                      <Trash2 size={13} strokeWidth={2.2} />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {resetTarget && (
        <ResetPasswordModal
          userId={resetTarget.id}
          userName={`${resetTarget.firstName} ${resetTarget.lastName}`}
          onClose={() => setResetTarget(null)}
        />
      )}

      {editingProvider && (
        <EditProviderModal
          provider={editingProvider}
          onClose={() => setEditingProvider(null)}
          onSaved={(updated) => {
            setProviders((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            setEditingProvider(null);
          }}
        />
      )}
    </div>
  );
}
