import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getUnreadCount } from '../api/notifications';

const POLL_MS = 30000;

export interface NotificationsContextValue {
  unreadCount: number;
  refreshUnreadCount: () => void;
  decrementUnread: (by?: number) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(() => {
    getUnreadCount().then((r) => setUnreadCount(r.count)).catch(() => {});
  }, []);

  const decrementUnread = useCallback((by = 1) => {
    setUnreadCount((c) => Math.max(0, c - by));
  }, []);

  useEffect(() => {
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, POLL_MS);
    return () => clearInterval(interval);
  }, [refreshUnreadCount]);

  return (
    <NotificationsContext.Provider value={{ unreadCount, refreshUnreadCount, decrementUnread }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotificationsBadge(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotificationsBadge must be used within <NotificationsProvider>');
  return ctx;
}
