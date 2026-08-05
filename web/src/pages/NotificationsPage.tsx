import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react';
import { getNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification } from '../api/notifications';
import type { Notification } from '../api/notifications';
import { useNotificationsBadge } from '../context/NotificationsContext';
import { Spinner } from '../components/Spinner';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const { refreshUnreadCount, decrementUnread } = useNotificationsBadge();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  useEffect(() => {
    getNotifications()
      .then(setNotifications)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function markOneRead(n: Notification) {
    if (n.readAt) return;
    try {
      await markNotificationRead(n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      decrementUnread();
    } catch {
      // non-fatal
    }
  }

  async function handleClickNotification(n: Notification) {
    await markOneRead(n);
    if (n.patientId) navigate(`/patients/${n.patientId}`);
  }

  async function handleMarkAsReadOnly(e: MouseEvent, n: Notification) {
    e.stopPropagation();
    await markOneRead(n);
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((x) => (x.readAt ? x : { ...x, readAt: now })));
      refreshUnreadCount();
    } catch {
      // non-fatal
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleDelete(e: MouseEvent, n: Notification) {
    e.stopPropagation();
    setDeletingId(n.id);
    try {
      await deleteNotification(n.id);
      setNotifications((prev) => prev.filter((x) => x.id !== n.id));
      if (!n.readAt) decrementUnread();
      else refreshUnreadCount();
    } catch {
      // non-fatal
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Care team</p>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">{notifications.length} notification{notifications.length !== 1 ? 's' : ''}</p>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-secondary" disabled={markingAll} onClick={handleMarkAllRead}>
            <CheckCheck size={14} strokeWidth={2.2} />
            {markingAll ? 'Marking…' : 'Mark all as read'}
          </button>
        )}
      </div>

      {loading ? (
        <Spinner />
      ) : notifications.length === 0 ? (
        <div className="empty-state">No notifications yet.</div>
      ) : (
        <div className="card-list">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="row row-clickable"
              onClick={() => handleClickNotification(n)}
              style={{ background: n.readAt ? undefined : 'var(--color-primary-bg)' }}
            >
              <div className="avatar" style={{ background: 'var(--color-primary-bg)', color: 'var(--color-primary)' }}>
                <Bell size={16} strokeWidth={2.2} />
              </div>
              <div className="row-body">
                <div className="row-name">{n.title}</div>
                <div className="row-sub">{n.body}</div>
                <div className="row-sub">{formatWhen(n.createdAt)}</div>
              </div>
              <div className="row-actions">
                {!n.readAt && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => handleMarkAsReadOnly(e, n)}
                    aria-label="Mark as read"
                  >
                    <Check size={13} strokeWidth={2.2} />
                  </button>
                )}
                <button
                  className="btn btn-danger btn-sm"
                  disabled={deletingId === n.id}
                  onClick={(e) => handleDelete(e, n)}
                  aria-label="Delete notification"
                >
                  <Trash2 size={13} strokeWidth={2.2} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
