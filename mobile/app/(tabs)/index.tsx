import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/auth';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { TodayMedicationCard } from '../../components/MedicationCard';
import { HealthLogCard } from '../../components/HealthLogCard';
import { colors, spacing, typography } from '../../theme';
import { getTodaySchedule, logDose, type TodayScheduleItem } from '../../api/assignments';
import { getHealthLogs, type HealthLog } from '../../api/healthLog';
import { getSummary, type PatientSummary } from '../../api/timeline';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const TREND_ARROW: Record<string, string> = { UP: '↑', DOWN: '↓', STABLE: '→' };
const TREND_COLOR: Record<string, string> = {
  UP:     colors.danger    ?? '#ef4444',
  DOWN:   colors.success   ?? '#22c55e',
  STABLE: colors.text.muted,
};

export default function DashboardScreen() {
  const { user } = useAuth();
  const router   = useRouter();
  const isPatient = user?.role === 'PATIENT';
  const patientId = user?.patientProfile?.id ?? null;

  const [schedule,        setSchedule]        = useState<TodayScheduleItem[]>([]);
  const [recentLogs,      setRecentLogs]      = useState<HealthLog[]>([]);
  const [summary,         setSummary]         = useState<PatientSummary | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [refreshing,      setRefreshing]      = useState(false);
  const [markingId,       setMarkingId]       = useState<number | null>(null);

  const loadPatientData = useCallback(async (isRefresh = false) => {
    if (!patientId) return;
    if (isRefresh) setRefreshing(true); else setScheduleLoading(true);
    try {
      const [scheduleData, logsData, summaryData] = await Promise.all([
        getTodaySchedule(patientId),
        getHealthLogs(patientId, { limit: 3 }),
        getSummary(patientId),
      ]);
      setSchedule(scheduleData);
      setRecentLogs(logsData);
      setSummary(summaryData);
    } catch {
      // Silently keep the empty state — dashboard shouldn't hard-crash
    } finally {
      setScheduleLoading(false);
      setRefreshing(false);
    }
  }, [patientId]);

  useEffect(() => {
    if (isPatient) loadPatientData();
  }, [isPatient, loadPatientData]);

  const handleMarkTaken = useCallback(async (assignmentId: number) => {
    setMarkingId(assignmentId);
    try {
      const log = await logDose(assignmentId, { status: 'TAKEN' });
      setSchedule((prev) =>
        prev.map((item) =>
          item.id === assignmentId ? { ...item, todayLog: log } : item,
        ),
      );
    } catch (e) {
      Alert.alert('Could not log dose', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setMarkingId(null);
    }
  }, []);

  const dueCount = schedule.filter((i) => !i.todayLog).length;
  const takenCount = schedule.filter((i) => i.todayLog?.status === 'TAKEN').length;
  const adherence =
    schedule.length > 0 ? Math.round((takenCount / schedule.length) * 100) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadPatientData(true)}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greetingLabel}>{greeting()},</Text>
              <Text style={styles.greetingName}>
                {user?.firstName} {user?.lastName}
              </Text>
            </View>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.firstName?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
          </View>
          <Text style={styles.dateText}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>

        {/* ── Quick stats row ── */}
        <View style={styles.statsRow}>
          <StatBadge
            icon="💊"
            label="Medications"
            value={isPatient && schedule.length > 0 ? String(schedule.length) : '—'}
          />
          <StatBadge
            icon="✅"
            label="Taken today"
            value={isPatient && schedule.length > 0 ? String(takenCount) : '—'}
          />
          <StatBadge
            icon="📊"
            label="Adherence"
            value={adherence !== null ? `${adherence}%` : '—'}
          />
        </View>

        {/* ── Health summary (patients only) ── */}
        {isPatient && summary && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Health Summary</Text>
              <TouchableOpacity onPress={() => patientId && router.push(`/history/${patientId}`)}>
                <Text style={summaryStyles.viewAll}>View history →</Text>
              </TouchableOpacity>
            </View>
            <View style={summaryStyles.row}>
              {/* 7-day adherence */}
              <View style={summaryStyles.card}>
                <Text style={summaryStyles.value}>
                  {summary.adherence.last7d.rate !== null ? `${summary.adherence.last7d.rate}%` : '—'}
                </Text>
                <Text style={summaryStyles.label}>7-day adherence</Text>
              </View>
              {/* Weight trend */}
              <View style={summaryStyles.card}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                  <Text style={summaryStyles.value}>
                    {summary.weight.latest !== null ? String(summary.weight.latest) : '—'}
                  </Text>
                  {summary.weight.trend && (
                    <Text style={[summaryStyles.trendArrow, { color: TREND_COLOR[summary.weight.trend] }]}>
                      {TREND_ARROW[summary.weight.trend]}
                    </Text>
                  )}
                </View>
                <Text style={summaryStyles.label}>
                  {summary.weight.latest !== null ? 'kg (weight)' : 'No weight'}
                </Text>
              </View>
              {/* Last check-in */}
              <View style={summaryStyles.card}>
                <Text style={summaryStyles.value}>
                  {summary.daysSinceLastLog !== null ? String(summary.daysSinceLastLog) : '—'}
                </Text>
                <Text style={summaryStyles.label}>
                  {summary.daysSinceLastLog === 0 ? 'Logged today' : 'days since log'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Today's Medications ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Medications</Text>
            {isPatient && schedule.length > 0 && (
              <Text style={styles.sectionBadge}>{dueCount} due</Text>
            )}
          </View>

          {!isPatient ? (
            <Card>
              <EmptyState
                icon="💊"
                title="Staff view"
                subtitle="Patient medication schedules are managed via the Medications tab."
              />
            </Card>
          ) : scheduleLoading ? (
            <Card style={styles.loadingCard}>
              <ActivityIndicator color={colors.primary} />
            </Card>
          ) : schedule.length === 0 ? (
            <Card>
              <EmptyState
                icon="💊"
                title="Nothing scheduled today"
                subtitle="Your care team hasn't set up a schedule yet — check back soon."
              />
            </Card>
          ) : (
            schedule.map((item) => (
              <TodayMedicationCard
                key={item.id}
                item={item}
                onMarkTaken={handleMarkTaken}
                disabled={markingId === item.id}
              />
            ))
          )}
        </View>

        {/* ── Recent Health Logs ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Health Logs</Text>
          </View>
          {!isPatient ? (
            <Card>
              <EmptyState
                icon="📈"
                title="Staff view"
                subtitle="Patient health logs are managed via the Health Log tab."
              />
            </Card>
          ) : scheduleLoading ? (
            <Card style={styles.loadingCard}>
              <ActivityIndicator color={colors.primary} />
            </Card>
          ) : recentLogs.length === 0 ? (
            <Card>
              <EmptyState
                icon="📈"
                title="No health logs yet"
                subtitle="Tap Health Log below to record your weight, mood, and more."
              />
            </Card>
          ) : (
            recentLogs.map((log) => <HealthLogCard key={log.id} log={log} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBadge({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={statStyles.badge}>
      <Text style={statStyles.icon}>{icon}</Text>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  row:  { flexDirection: 'row', gap: spacing.sm },
  card: {
    flex: 1,
    backgroundColor: colors.bg.card,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  value:      { ...typography.h3, color: colors.text.primary },
  label:      { ...typography.caption, color: colors.text.muted, textAlign: 'center' },
  trendArrow: { ...typography.h4, fontWeight: '700' as const },
  viewAll:    { ...typography.caption, color: colors.primary },
});

const statStyles = StyleSheet.create({
  badge: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: { fontSize: 22 },
  value: { ...typography.h3, color: colors.text.primary },
  label: { ...typography.caption, color: colors.text.muted, textAlign: 'center' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.app },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  header: { paddingTop: spacing.md, gap: spacing.xs },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greetingLabel: { ...typography.body1, color: colors.text.secondary },
  greetingName: { ...typography.h1, color: colors.text.primary },
  dateText: { ...typography.body2, color: colors.text.muted },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  avatarText: { ...typography.h3, color: colors.primary },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  section: { gap: spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { ...typography.h3, color: colors.text.primary },
  sectionBadge: {
    ...typography.caption,
    color: colors.text.muted,
    backgroundColor: colors.bg.subtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 99,
  },
  loadingCard: { paddingVertical: spacing.xl, alignItems: 'center' },
});
