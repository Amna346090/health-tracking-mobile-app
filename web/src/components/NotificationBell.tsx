import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { getNotifications, getUnreadCount, markNotificationRead } from '../api/notifications';
import type { Notification } from '../api/notifications';

const POLL_MS = 30000;

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function poll() {
      getUnreadCount().then((r) => setUnreadCount(r.count)).catch(() => {});
    }
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleOpen() {
    setOpen((v) => !v);
    if (!open) {
      getNotifications().then(setNotifications).catch(() => {});
    }
  }

  async function handleClickNotification(n: Notification) {
    if (!n.readAt) {
      try {
        await markNotificationRead(n.id);
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // non-fatal
      }
    }
    setOpen(false);
    if (n.patientId) navigate(`/patients/${n.patientId}`);
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button className="sidebar-signout" onClick={handleOpen} style={{ width: '100%' }}>
        <Bell size={14} strokeWidth={2.2} />
        Notifications
        {unreadCount > 0 && <span className="badge badge-overdue">{unreadCount}</span>}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
            marginBottom: 8,
            maxHeight: 360,
            overflowY: 'auto',
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 20,
          }}
        >
          {notifications.length === 0 ? (
            <div style={{ padding: 16, fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center' }}>
              No notifications yet.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleClickNotification(n)}
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--color-border)',
                  cursor: 'pointer',
                  background: n.readAt ? 'transparent' : 'var(--color-primary-bg)',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>{n.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', marginTop: 2 }}>{n.body}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{formatWhen(n.createdAt)}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
