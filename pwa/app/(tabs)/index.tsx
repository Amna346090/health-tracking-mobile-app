import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { onPushEvent } from '../../lib/pushEvents';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/auth';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { TodayMedicationCard } from '../../components/MedicationCard';
import { HealthLogCard } from '../../components/HealthLogCard';
import { colors, spacing, typography } from '../../theme';
import { getTodaySchedule, logDose, type TodayScheduleItem } from '../../api/assignments';
import { getHealthLogs, type HealthLog } from '../../api/healthLog';
import { getSummary, type PatientSummary } from '../../api/timeline';
import { getAppointments, type Appointment } from '../../api/appointments';
import { getMessages, type Message } from '../../api/messages';
import { getTestRequests, type TestRequest } from '../../api/testRequests';
import { getUnreadCount } from '../../api/notifications';

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
  const isAdmin = user?.role === 'ADMIN';
  const showsNotificationsBell = isAdmin || isPatient;
  const patientId = user?.patientProfile?.id ?? null;

  const [unreadCount, setUnreadCount] = useState(0);
  const [schedule,        setSchedule]        = useState<TodayScheduleItem[]>([]);
  const [recentLogs,      setRecentLogs]      = useState<HealthLog[]>([]);
  const [summary,         setSummary]         = useState<PatientSummary | null>(null);
  const [appointments,    setAppointments]    = useState<Appointment[]>([]);
  const [messages,        setMessages]        = useState<Message[]>([]);
  const [testRequests,    setTestRequests]    = useState<TestRequest[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [refreshing,      setRefreshing]      = useState(false);
  const [markingId,       setMarkingId]       = useState<number | null>(null);

  const hasLoadedPatientDataRef = useRef(false);

  const loadPatientData = useCallback(async (isRefresh = false) => {
    if (!patientId) return;
    if (isRefresh) setRefreshing(true); else if (!hasLoadedPatientDataRef.current) setScheduleLoading(true);
    try {
      const [scheduleData, logsData, summaryData, appointmentsData, messagesData, testRequestsData] = await Promise.all([
        getTodaySchedule(patientId),
        getHealthLogs(patientId, { limit: 3 }),
        getSummary(patientId),
        getAppointments(patientId),
        getMessages(patientId),
        getTestRequests(patientId),
      ]);
      setSchedule(scheduleData);
      setRecentLogs(logsData);
      setSummary(summaryData);
      setAppointments(appointmentsData);
      setMessages(messagesData);
      setTestRequests(testRequestsData);
    } catch {
      // Silently keep the empty state — dashboard shouldn't hard-crash
    } finally {
      setScheduleLoading(false);
      setRefreshing(false);
      hasLoadedPatientDataRef.current = true;
    }
  }, [patientId]);

  useFocusEffect(useCallback(() => {
    if (isPatient) loadPatientData();
  }, [isPatient, loadPatientData]));

  // Live refresh: a push arrives while this chat is open, or an existing patient
  // message/appointment/test-request thread has moved — quietly refetch.
  useEffect(() => {
    if (!isPatient) return;
    return onPushEvent('notification', () => loadPatientData());
  }, [isPatient, loadPatientData]);

  const refreshUnreadCount = useCallback(() => {
    if (!showsNotificationsBell) return;
    getUnreadCount().then((r) => setUnreadCount(r.count)).catch(() => {});
  }, [showsNotificationsBell]);

  useFocusEffect(useCallback(() => { refreshUnreadCount(); }, [refreshUnreadCount]));

  // Live refresh: push arrives while dashboard is open → update the bell badge instantly.
  useEffect(() => {
    if (!showsNotificationsBell) return;
    return onPushEvent('notification', refreshUnreadCount);
  }, [showsNotificationsBell, refreshUnreadCount]);

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

  const upcomingAppointments = appointments
    .filter((a) => (a.status === 'SCHEDULED' || a.status === 'RESCHEDULED') && new Date(a.scheduledFor).getTime() >= Date.now())
    .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
  const unreadMessageCount = messages.filter((m) => !m.readAt).length;
  const openTestRequestCount = testRequests.filter((r) => r.status === 'PENDING').length;

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
            <View style={styles.headerActions}>
              {showsNotificationsBell && (
                <TouchableOpacity style={styles.bellBtn} onPress={() => router.push('/notifications')}>
                  <Feather name="bell" size={19} color={colors.text.primary} />
                  {unreadCount > 0 && (
                    <View style={styles.bellBadge}>
                      <Text style={styles.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user?.firstName?.[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>
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

        {/* ── Quick stats row (patients only) ── */}
        {isPatient && (
          <View style={styles.statsRow}>
            <StatBadge icon="💊" label="Peptides" value={schedule.length > 0 ? String(schedule.length) : '—'} />
            <StatBadge icon="✅" label="Taken today" value={schedule.length > 0 ? String(takenCount) : '—'} />
            <StatBadge icon="📊" label="Adherence" value={adherence !== null ? `${adherence}%` : '—'} />
          </View>
        )}

        {/* ── Care team quick links (staff/admin only) ── */}
        {!isPatient && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.navCard} onPress={() => router.push('/(tabs)/patients')} activeOpacity={0.8}>
              <View style={styles.navCardLeft}>
                <Feather name="users" size={18} color={colors.primary} />
                <View>
                  <Text style={styles.navCardText}>Patients</Text>
                  <Text style={styles.navCardSubtext}>View and manage all patients</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color={colors.text.muted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.navCard} onPress={() => router.push('/(tabs)/medications')} activeOpacity={0.8}>
              <View style={styles.navCardLeft}>
                <Feather name="package" size={18} color={colors.primary} />
                <View>
                  <Text style={styles.navCardText}>Peptides</Text>
                  <Text style={styles.navCardSubtext}>Manage peptide types and doses</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color={colors.text.muted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.navCard} onPress={() => router.push('/(tabs)/touch-base-queue')} activeOpacity={0.8}>
              <View style={styles.navCardLeft}>
                <Feather name="heart" size={18} color={colors.primary} />
                <View>
                  <Text style={styles.navCardText}>Touch-Base</Text>
                  <Text style={styles.navCardSubtext}>Patients due for a check-in</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color={colors.text.muted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.navCard} onPress={() => router.push('/notifications')} activeOpacity={0.8}>
              <View style={styles.navCardLeft}>
                <Feather name="bell" size={18} color={colors.primary} />
                <View>
                  <Text style={styles.navCardText}>Notifications</Text>
                  <Text style={styles.navCardSubtext}>Alerts and updates for your account</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color={colors.text.muted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.navCard} onPress={() => router.push('/appointments')} activeOpacity={0.8}>
              <View style={styles.navCardLeft}>
                <Feather name="calendar" size={18} color={colors.primary} />
                <View>
                  <Text style={styles.navCardText}>Appointments</Text>
                  <Text style={styles.navCardSubtext}>Upcoming visits with patients</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color={colors.text.muted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.navCard} onPress={() => router.push('/test-requests')} activeOpacity={0.8}>
              <View style={styles.navCardLeft}>
                <Feather name="clipboard" size={18} color={colors.primary} />
                <View>
                  <Text style={styles.navCardText}>Test/scan requests</Text>
                  <Text style={styles.navCardSubtext}>Lab and imaging orders to track</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color={colors.text.muted} />
            </TouchableOpacity>
          </View>
        )}

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

        {/* ── Today's Medications (patients only) ── */}
        {isPatient && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Peptides</Text>
            {schedule.length > 0 && (
              <Text style={styles.sectionBadge}>{dueCount} due</Text>
            )}
          </View>

          {scheduleLoading ? (
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
        )}

        {/* ── Upcoming Appointments ── */}
        {isPatient && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
              <TouchableOpacity onPress={() => patientId && router.push(`/appointments/${patientId}`)}>
                <Text style={summaryStyles.viewAll}>
                  {upcomingAppointments.length > 0 ? 'View all →' : 'Request →'}
                </Text>
              </TouchableOpacity>
            </View>
            {scheduleLoading ? (
              <Card style={styles.loadingCard}>
                <ActivityIndicator color={colors.primary} />
              </Card>
            ) : upcomingAppointments.length === 0 ? (
              <Card>
                <EmptyState
                  icon="🗓️"
                  title="No upcoming appointments"
                  subtitle="Tap above to request one with your care team."
                />
              </Card>
            ) : (
              upcomingAppointments.slice(0, 2).map((a) => (
                <Card key={a.id} style={styles.loadingCard}>
                  <Text style={{ ...typography.h4, color: colors.text.primary }}>
                    {new Date(a.scheduledFor).toLocaleString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </Text>
                  <Text style={{ ...typography.body2, color: colors.text.muted, marginTop: 2 }}>
                    {a.reason || 'No reason given'}
                  </Text>
                </Card>
              ))
            )}
          </View>
        )}

        {/* ── Messages ── */}
        {isPatient && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Messages</Text>
              {unreadMessageCount > 0 && (
                <Text style={styles.sectionBadge}>{unreadMessageCount} unread</Text>
              )}
            </View>
            <TouchableOpacity onPress={() => patientId && router.push(`/messages/${patientId}`)}>
              <Card>
                {messages.length === 0 ? (
                  <EmptyState
                    icon="💬"
                    title="No messages yet"
                    subtitle="Your care team hasn't sent any messages yet."
                  />
                ) : (
                  <View>
                    <Text style={{ ...typography.body1, color: colors.text.primary }} numberOfLines={2}>
                      {messages[0].body}
                    </Text>
                    <Text style={summaryStyles.viewAll}>View inbox →</Text>
                  </View>
                )}
              </Card>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Documents ── */}
        {isPatient && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Documents</Text>
            </View>
            <TouchableOpacity onPress={() => patientId && router.push(`/documents/${patientId}`)}>
              <Card>
                <Text style={summaryStyles.viewAll}>Upload or view your documents →</Text>
              </Card>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Notes (from your care team) ── */}
        {isPatient && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Notes</Text>
            </View>
            <TouchableOpacity onPress={() => patientId && router.push(`/notes/${patientId}`)}>
              <Card>
                <Text style={summaryStyles.viewAll}>View notes from your care team →</Text>
              </Card>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Test/Scan Requests ── */}
        {isPatient && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Test/Scan Requests</Text>
              {openTestRequestCount > 0 && (
                <Text style={styles.sectionBadge}>{openTestRequestCount} open</Text>
              )}
            </View>
            <TouchableOpacity onPress={() => patientId && router.push(`/test-requests/${patientId}`)}>
              <Card>
                {testRequests.length === 0 ? (
                  <EmptyState
                    icon="🧪"
                    title="No test/scan requests"
                    subtitle="Your care team hasn't requested any tests or scans yet."
                  />
                ) : (
                  <Text style={summaryStyles.viewAll}>View requests →</Text>
                )}
              </Card>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Health Metrics ── */}
        {isPatient && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Health Metrics</Text>
            </View>
            <TouchableOpacity onPress={() => patientId && router.push(`/health-metrics/${patientId}`)}>
              <Card>
                <Text style={summaryStyles.viewAll}>Log cholesterol, bloodwork, and more →</Text>
              </Card>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Recent Health Logs (patients only) ── */}
        {isPatient && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Health Logs</Text>
          </View>
          {scheduleLoading ? (
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
        )}
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  bellBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: { fontSize: 10, fontWeight: '600' as const, color: colors.text.inverse },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.h3, color: colors.primary },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  navCardLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  navCardText: { ...typography.body1, fontWeight: '500' as const, color: colors.text.primary },
  navCardSubtext: { ...typography.caption, color: colors.text.muted, marginTop: 1 },
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
