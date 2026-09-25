/**
 * Fleet-wide test/scan requests board — staff/admin only. Mirrors web/src/pages/TestRequestsPage.tsx.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { colors, radius, shadows, spacing, typography } from '../../theme';
import { getAllTestRequests, type TestRequestWithPatient, type TestRequestStatus } from '../../api/testRequests';
import { PullToRefreshIndicator } from '../../components/PullToRefreshIndicator';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { cache, onCacheChanged } from '../../offline/cache';
import { sameList } from '../../offline/util';

const STATUS_KEY: Record<TestRequestStatus, string> = {
  PENDING: 'testRequests.status.pending',
  SUBMITTED: 'testRequests.status.submitted',
  CANCELLED: 'testRequests.status.cancelled',
};

// Matches the backend's exact rule (backend/src/services/testRequest.service.ts): pending
// and due before today (UTC, date-only) — not just "before this exact moment", so something
// due today isn't wrongly flagged overdue a few hours early.
function isOverdue(req: TestRequestWithPatient): boolean {
  if (req.status !== 'PENDING') return false;
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);
  return new Date(req.dueDate).getTime() < todayUTC.getTime();
}

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TestRequestsQueueScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const initialRequests = () => cache.listSync<TestRequestWithPatient>('testRequests').filter((r) => r.patient);
  const [requests, setRequests] = useState<TestRequestWithPatient[]>(initialRequests);
  const [loading, setLoading] = useState(() => initialRequests().length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'overdue'>('all');

  const hasLoadedRef = useRef(false);

  // Local-only refresh — works for both filters now. "All" just shows everything cached;
  // "overdue" applies the same overdue rule locally instead of needing to ask the server,
  // so the filter works instantly and offline too.
  const refreshFromCache = useCallback(async (): Promise<number> => {
    const all = (await cache.list<TestRequestWithPatient>('testRequests')).filter((r) => r.patient);
    const cached = filter === 'overdue' ? all.filter(isOverdue) : all;
    setRequests((prev) => (sameList(prev, cached) ? prev : cached));
    if (all.length > 0) setLoading(false);
    return all.length;
  }, [filter]);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else if (!hasLoadedRef.current) setLoading(true);
    await refreshFromCache();
    try {
      const data = await getAllTestRequests(filter === 'overdue' ? { overdue: true } : undefined);
      // Always cache the full picture, never just the filtered subset — that would wipe out
      // cached requests that simply don't match today's "overdue" filter.
      if (filter === 'all') await cache.putMany('testRequests', data);
      setRequests((prev) => (sameList(prev, data) ? prev : data));
    } catch {
      // offline or request failed — keep showing whatever was computed from cache
    } finally {
      setLoading(false);
      setRefreshing(false);
      hasLoadedRef.current = true;
    }
  }, [filter, refreshFromCache]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => onCacheChanged('testRequests', () => refreshFromCache()), [refreshFromCache]);

  const { pullProgress, scrollHandlers } = usePullToRefresh(() => load(true));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PullToRefreshIndicator pullProgress={pullProgress} refreshing={refreshing} />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>{t('common.backWithArrow')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('testRequests.title')}</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>{t('testRequests.all')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'overdue' && styles.filterBtnActive]}
          onPress={() => setFilter('overdue')}
        >
          <Text style={[styles.filterText, filter === 'overdue' && styles.filterTextActive]}>{t('testRequests.overdueOnly')}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          {...scrollHandlers}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t('testRequests.noneYet')}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const overdue = isOverdue(item);
            return (
              <TouchableOpacity style={styles.card} onPress={() => router.push(`/patient-dashboard/${item.patientId}`)} activeOpacity={0.8}>
                <View style={styles.cardBody}>
                  <Text style={styles.cardName}>{item.patient.user.firstName} {item.patient.user.lastName}</Text>
                  <Text style={styles.cardSub}>{item.name} · {t('testRequests.due', { date: formatDate(item.dueDate, t('language.locale')) })}</Text>
                </View>
                <View style={[styles.badge, overdue ? styles.badgeOverdue : styles.badgeDefault]}>
                  <Text style={[styles.badgeText, overdue ? styles.badgeTextOverdue : styles.badgeTextDefault]}>
                    {overdue ? t('touchBase.overdue') : t(STATUS_KEY[item.status])}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.app, position: 'relative' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  backText: { ...typography.body1, color: colors.primary },
  title: { ...typography.h3, color: colors.text.primary },

  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  filterBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg.card },
  filterBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { ...typography.body2, color: colors.text.secondary },
  filterTextActive: { color: colors.text.inverse, fontWeight: '600' as const },

  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  emptyText: { ...typography.body2, color: colors.text.muted, textAlign: 'center', paddingHorizontal: spacing.lg },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  cardBody: { flex: 1, gap: 2 },
  cardName: { ...typography.body1, fontWeight: '600' as const, color: colors.text.primary },
  cardSub: { ...typography.caption, color: colors.text.secondary },

  badge: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  badgeDefault: { backgroundColor: colors.primaryBg },
  badgeOverdue: { backgroundColor: colors.dangerBg },
  badgeText: { ...typography.caption, fontWeight: '600' as const },
  badgeTextDefault: { color: colors.primary },
  badgeTextOverdue: { color: colors.danger },
});
