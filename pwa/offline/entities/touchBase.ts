// Computes the touch-base "who's overdue / coming up" list entirely from what's already
// saved on the phone — a direct port of the same math the backend uses in
// backend/src/services/touchBase.service.ts, so results match exactly whether the phone
// asks the server or figures it out itself. This means the queue shows instantly and works
// fully offline, instead of needing a live round trip just to see who needs a check-in.
import { cache } from '../cache';
import { listPatientsCached, type OfflinePatientRow } from './patients';
import type { TouchBaseQueueItem, TouchBaseSettings } from '../../api/touchBase';
import type { IdLike } from '../types';

const NEARING_WINDOW_DAYS = 3;
const SETTINGS_DOC_ID = 'default';

interface CachedSettings extends Omit<TouchBaseSettings, 'id'> {
  id: IdLike;
}

export async function getTouchBaseSettingsCached(): Promise<CachedSettings | undefined> {
  return cache.get<CachedSettings>('settings', SETTINGS_DOC_ID);
}

export function getTouchBaseSettingsCachedSync(): CachedSettings | undefined {
  return cache.getSync<CachedSettings>('settings', SETTINGS_DOC_ID);
}

export async function mergeTouchBaseSettingsFromServer(settings: TouchBaseSettings): Promise<void> {
  await cache.put<CachedSettings>('settings', { ...settings, id: SETTINGS_DOC_ID });
}

/** Same rule as the server: the threshold repeats on a fixed cycle from `thresholdSetAt`,
 * regardless of contact — "mark as contacted" only silences the *current* cycle. */
function computeDueDate(
  thresholdSetAt: string,
  thresholdDays: number,
  lastContactAt: string | null,
  now: number,
): { dueAt: number; overdue: boolean } {
  const setAt = new Date(thresholdSetAt).getTime();
  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
  const periodsElapsed = Math.floor((now - setAt) / thresholdMs);

  if (periodsElapsed >= 1) {
    const currentCycleBoundary = setAt + periodsElapsed * thresholdMs;
    const lastContactMs = lastContactAt ? new Date(lastContactAt).getTime() : null;
    const acknowledgedThisCycle = lastContactMs !== null && lastContactMs >= currentCycleBoundary;
    if (!acknowledgedThisCycle) {
      return { dueAt: currentCycleBoundary, overdue: true };
    }
    return { dueAt: setAt + (periodsElapsed + 1) * thresholdMs, overdue: false };
  }

  return { dueAt: setAt + thresholdMs, overdue: false };
}

function computeQueue(patients: OfflinePatientRow[], defaultThresholdDays: number): TouchBaseQueueItem[] {
  const now = Date.now();
  const nearingCutoff = now + NEARING_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const results: TouchBaseQueueItem[] = [];
  for (const p of patients) {
    if (p.touchBaseRemindersPaused) continue;
    if (!p.thresholdSetAt) continue; // haven't cached this field for this patient yet

    const thresholdDays = p.touchBaseThresholdDays ?? defaultThresholdDays;
    const { dueAt, overdue } = computeDueDate(p.thresholdSetAt, thresholdDays, p.lastContactAt, now);

    if (overdue || dueAt <= nearingCutoff) {
      results.push({
        id: p.id as number,
        lastContactAt: p.lastContactAt,
        thresholdDays,
        dueAt: new Date(dueAt).toISOString(),
        overdue,
        user: { firstName: p.user.firstName, lastName: p.user.lastName, email: p.user.email ?? '' },
      });
    }
  }

  return results.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}

/** Local equivalent of GET /touch-base/queue — computed from cached patients + cached
 * settings only, no network call required. */
export async function getTouchBaseQueueFromCache(): Promise<TouchBaseQueueItem[]> {
  const [patients, settings] = await Promise.all([listPatientsCached(), getTouchBaseSettingsCached()]);
  return computeQueue(patients, settings?.defaultThresholdDays ?? 30);
}

/** Synchronous version for use as a useState initializer — instant first paint. */
export function getTouchBaseQueueFromCacheSync(): TouchBaseQueueItem[] {
  const patients = cache.listSync<OfflinePatientRow>('patients');
  const settings = getTouchBaseSettingsCachedSync();
  return computeQueue(patients, settings?.defaultThresholdDays ?? 30);
}
