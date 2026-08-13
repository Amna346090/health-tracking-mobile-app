/**
 * Tiny in-app event bus. Lets the push-notification listener (mounted once at
 * the root layout) tell whichever screen is currently open that new data
 * arrived, so that screen can quietly refetch — no polling involved.
 */
type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();

export function onPushEvent(event: string, listener: Listener): () => void {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(listener);
  return () => listeners.get(event)?.delete(listener);
}

export function emitPushEvent(event: string): void {
  listeners.get(event)?.forEach((listener) => listener());
}
