import { Platform } from 'react-native';

type Listener = (online: boolean) => void;
const listeners = new Set<Listener>();

let online = Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.onLine : true;

export function isOnline(): boolean {
  return online;
}

function setOnline(value: boolean) {
  if (online === value) return;
  online = value;
  for (const fn of listeners) fn(online);
}

export function onConnectivityChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let initialized = false;

/** Wires up browser online/offline events. Safe to call multiple times; only web has any effect. */
export function initConnectivityWatcher(): void {
  if (initialized || Platform.OS !== 'web' || typeof window === 'undefined') return;
  initialized = true;
  window.addEventListener('online', () => setOnline(true));
  window.addEventListener('offline', () => setOnline(false));
}
