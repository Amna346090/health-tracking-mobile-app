import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { getAccessToken } from '../api/client';
import { emitPushEvent } from './pushEvents';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api';

function wsUrl(): string {
  const httpBase = API_BASE.replace(/\/api\/?$/, '');
  return httpBase.replace(/^http/, 'ws') + '/ws';
}

// Web has no equivalent of a native push-notification-received listener, so this opens
// a small authenticated WebSocket instead — the backend sends the same event names
// (see broadcastToUser in backend/src/lib/realtime.ts) that the native app's push
// listener already emits via emitPushEvent, so every screen already listening via
// onPushEvent (messages, the notification badge, etc.) needs no changes at all.
// No-op on native — that path already works via real push notifications.
export function useRealtime(isLoggedIn: boolean): void {
  const socketRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const closedByUsRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !isLoggedIn) return;

    closedByUsRef.current = false;

    function connect() {
      const token = getAccessToken();
      if (!token) return;

      const socket = new WebSocket(`${wsUrl()}?token=${encodeURIComponent(token)}`);
      socketRef.current = socket;

      socket.onopen = () => { retryRef.current = 0; };

      socket.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data as string);
          if (typeof data.event === 'string') emitPushEvent(data.event);
        } catch {
          // ignore malformed frames
        }
      };

      socket.onclose = () => {
        if (closedByUsRef.current) return;
        const delay = Math.min(1000 * 2 ** retryRef.current, 30_000);
        retryRef.current += 1;
        retryTimerRef.current = setTimeout(connect, delay);
      };

      socket.onerror = () => socket.close();
    }

    connect();

    return () => {
      closedByUsRef.current = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [isLoggedIn]);
}
