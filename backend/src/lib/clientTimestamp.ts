/**
 * Parses a client-supplied timestamp for actions that may have been queued while the
 * device was offline (e.g. dose logs, touch-base contact) — lets the record keep the
 * time the action actually happened rather than whenever the request reaches the server.
 * Returns undefined (falls back to server "now") for anything missing or implausible,
 * so a malformed value never fails the request.
 */
export function parseClientTimestamp(raw: unknown): Date | undefined {
  if (typeof raw !== 'string' || !raw) return undefined;
  const date = new Date(raw);
  if (isNaN(date.getTime())) return undefined;
  const now = Date.now();
  const FIVE_MINUTES = 5 * 60 * 1000;
  if (date.getTime() > now + FIVE_MINUTES) return undefined; // clock skew guard, not a time machine
  return date;
}
