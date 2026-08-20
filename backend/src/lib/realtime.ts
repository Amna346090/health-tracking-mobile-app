import type { Server } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { verifyAccessToken } from './jwt';

// One JWT-authenticated WebSocket connection per open browser tab — used to push a
// tiny "something changed" signal to a specific user so the web app can refetch and
// re-render live, mirroring the same event names the native app's push-notification
// listener already emits (see pwa/lib/pushEvents.ts). No sensitive data travels over
// this channel — just an event name; the client re-fetches via the normal REST API.
const userSockets = new Map<number, Set<WebSocket>>();

export function initRealtime(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (socket, req) => {
    const url = new URL(req.url ?? '', 'http://localhost');
    const token = url.searchParams.get('token');

    let userId: number;
    try {
      if (!token) throw new Error('missing token');
      userId = verifyAccessToken(token).sub;
    } catch {
      socket.close(4001, 'Unauthorized');
      return;
    }

    let sockets = userSockets.get(userId);
    if (!sockets) {
      sockets = new Set();
      userSockets.set(userId, sockets);
    }
    sockets.add(socket);

    // Keeps the connection alive through idle proxies/load balancers between real events
    const heartbeat = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) socket.ping();
    }, 30_000);

    socket.on('close', () => {
      clearInterval(heartbeat);
      const set = userSockets.get(userId);
      set?.delete(socket);
      if (set && set.size === 0) userSockets.delete(userId);
    });

    socket.on('error', () => socket.close());
  });
}

/** Sends a live event (matching a pushEvents key on the client) to every open tab for this user. */
export function broadcastToUser(userId: number, event: string): void {
  const sockets = userSockets.get(userId);
  if (!sockets || sockets.size === 0) return;
  const payload = JSON.stringify({ event });
  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) socket.send(payload);
  }
}
