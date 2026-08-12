import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, shadows, spacing, typography } from '../../theme';
import { api } from '../../api/client';
import { getTimeline, getSummary, type TimelineEvent, type PatientSummary } from '../../api/timeline';
import { FEELING_EMOJI } from '../../components/FeelingPicker';
import { getWeightTrend, type FeelingStatus, type WeightDataPoint } from '../../api/healthLog';
import { Avatar } from '../../components/Avatar';
import { WeightChart } from '../../components/WeightChart';
import { Feather } from '@expo/vector-icons';
import { markContacted } from '../../api/touchBase';
import { getAllProviders, type Provider } from '../../api/providers';
import { updatePatient } from '../../api/patients';
import { deleteUser } from '../../api/users';
import { Dropdown } from '../../components/Dropdown';
import { STAFF_FEATURES_ENABLED } from '../../config';
import { useAuth } from '../../context/auth';

interface PatientMeta {
  id: number;
  user: { id: number; firstName: string; lastName: string; email: string | null; username: string | null };
  dateOfBirth: string | null;
  gender: string | null;
  healthIssue: string | null;
  avatarUrl: string | null;
  lastContactAt: string | null;
  providerId: number | null;
  touchBaseThresholdDays: number | null;
  touchBaseRemindersPaused: boolean;
}

const TOUCH_BASE_THRESHOLD_PRESETS: { label: string; days: number }[] = [
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
  { label: '2 months', days: 60 },
  { label: '3 months', days: 90 },
];

// Admin-only, for verifying the reminder pipeline actually fires without waiting days/weeks.
const TEST_THRESHOLD_PRESETS: { label: string; days: number }[] = [
  { label: '1 minute', days: 1 / 1440 },
  { label: '5 minutes', days: 5 / 1440 },
  { label: '10 minutes', days: 10 / 1440 },
];

function formatThresholdDays(days: number): string {
  if (days < 1) return `${Math.round(days * 1440)} min`;
  return `${days} days`;
}

function formatLastContact(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ageFromDob(iso: string | null): number | null {
  if (!iso) return null;
  const dob = new Date(iso);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear =
    now.getMonth() > dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

function formatGender(gender: string | null): string | null {
  if (!gender) return null;
  if (gender === 'PREFER_NOT_TO_SAY') return 'Prefer not to say';
  return gender.charAt(0) + gender.slice(1).toLowerCase();
}

// ─── Adherence ring ───────────────────────────────────────────────────────────

function AdherenceBadge({ rate, label }: { rate: number | null; label: string }) {
  const pct = rate ?? 0;
  const color = pct >= 80 ? (colors.success ?? '#22c55e') : pct >= 50 ? colors.warning : colors.danger;
  return (
    <View style={crmStyles.statCard}>
      <Text style={[crmStyles.statValue, { color }]}>{rate !== null ? `${pct}%` : '—'}</Text>
      <Text style={crmStyles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Summary cards row ────────────────────────────────────────────────────────

const TREND_ARROW: Record<string, string> = { UP: '↑', DOWN: '↓', STABLE: '→' };

function SummaryRow({ summary }: { summary: PatientSummary }) {
  const trendSymbol = summary.weight.trend ? TREND_ARROW[summary.weight.trend] : null;
  const trendColor  = summary.weight.trend === 'UP'
    ? (colors.danger ?? '#ef4444')
    : summary.weight.trend === 'DOWN'
    ? (colors.success ?? '#22c55e')
    : colors.text.muted;

  return (
    <View style={crmStyles.statsRow}>
      <AdherenceBadge rate={summary.adherence.last7d.rate}  label="7-day adherence" />
      <AdherenceBadge rate={summary.adherence.last30d.rate} label="30-day adherence" />
      <View style={crmStyles.statCard}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
          <Text style={crmStyles.statValue}>
            {summary.weight.latest !== null ? `${summary.weight.latest}` : '—'}
          </Text>
          {trendSymbol && (
            <Text style={[crmStyles.trendArrow, { color: trendColor }]}>{trendSymbol}</Text>
          )}
        </View>
        <Text style={crmStyles.statLabel}>
          {summary.weight.latest !== null ? 'kg (weight)' : 'No weight data'}
        </Text>
      </View>
      <View style={crmStyles.statCard}>
        <Text style={crmStyles.statValue}>
          {summary.daysSinceLastLog !== null ? String(summary.daysSinceLastLog) : '—'}
        </Text>
        <Text style={crmStyles.statLabel}>
          {summary.daysSinceLastLog === 0 ? 'Logged today' : 'days since log'}
        </Text>
      </View>
    </View>
  );
}

// ─── Mini timeline event row ──────────────────────────────────────────────────

function MiniEventRow({ event }: { event: TimelineEvent }) {
  let icon = '•';
  let title = '';
  let sub = '';

  if (event.type === 'MEDICATION_LOG') {
    icon = event.status === 'TAKEN' ? '✅' : event.status === 'MISSED' ? '❌' : '⏭';
    title = event.medication.name;
    sub   = event.status.charAt(0) + event.status.slice(1).toLowerCase();
  } else if (event.type === 'HEALTH_LOG') {
    const emoji = event.feeling ? FEELING_EMOJI[event.feeling as FeelingStatus] : '';
    icon  = '📋';
    title = 'Health log';
    sub   = [event.weight ? `${event.weight} kg` : null, emoji].filter(Boolean).join(' · ') || 'Recorded';
  } else {
    icon  = '📷';
    title = 'Photo';
    sub   = event.caption ?? 'No caption';
  }

  return (
    <View style={crmStyles.miniEvent}>
      <Text style={crmStyles.miniIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={crmStyles.miniTitle}>{title}</Text>
        <Text style={crmStyles.miniSub}>{sub}</Text>
      </View>
      <Text style={crmStyles.miniTime}>
        {new Date(event.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </Text>
    </View>
  );
}

// ─── Basic info row ───────────────────────────────────────────────────────────

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={crmStyles.infoRow}>
      <Text style={crmStyles.infoLabel}>{label}</Text>
      <Text style={crmStyles.infoValue}>{value}</Text>
    </View>
  );
}

// ─── Quick-link button ────────────────────────────────────────────────────────

function QuickLink({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={crmStyles.quickLink} onPress={onPress} activeOpacity={0.8}>
      <Text style={crmStyles.quickLinkIcon}>{icon}</Text>
      <Text style={crmStyles.quickLinkLabel}>{label}</Text>
      <Text style={crmStyles.quickLinkArrow}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PatientDashboardScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const router = useRouter();
  const pid = Number(patientId);
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [patient,  setPatient]  = useState<PatientMeta | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [summary,  setSummary]  = useState<PatientSummary | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [trend,    setTrend]    = useState<WeightDataPoint[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [markingContacted, setMarkingContacted] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<PatientMeta>(`/patients/${pid}`),
      getSummary(pid),
      getTimeline(pid, { limit: 5 }),
      getWeightTrend(pid, 30),
    ])
      .then(([p, s, t, w]) => { setPatient(p); setSummary(s); setTimeline(t); setTrend(w); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pid]);

  useEffect(() => {
    if (STAFF_FEATURES_ENABLED) getAllProviders().then(setProviders).catch(() => {});
  }, []);

  async function handleMarkContacted() {
    setMarkingContacted(true);
    try {
      const result = await markContacted(pid);
      setPatient((prev) => (prev ? { ...prev, lastContactAt: result.lastContactAt } : prev));
    } finally {
      setMarkingContacted(false);
    }
  }

  async function handleSetThreshold(days: number | null) {
    const updated = await updatePatient(pid, { touchBaseThresholdDays: days });
    setPatient((prev) => (prev ? { ...prev, touchBaseThresholdDays: updated.touchBaseThresholdDays } : prev));
  }

  function handleDeletePatient() {
    if (!patient) return;
    Alert.alert(
      'Delete patient?',
      `Delete ${patient.user.firstName} ${patient.user.lastName}? This permanently removes their account and all associated health data. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteUser(patient.user.id);
            router.back();
          },
        },
      ],
    );
  }

  async function handleTogglePause() {
    if (!patient) return;
    const updated = await updatePatient(pid, { touchBaseRemindersPaused: !patient.touchBaseRemindersPaused });
    setPatient((prev) => (prev ? { ...prev, touchBaseRemindersPaused: updated.touchBaseRemindersPaused } : prev));
  }

  if (loading) {
    return (
      <SafeAreaView style={crmStyles.safe} edges={['top']}>
        <View style={crmStyles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  const patientName = patient
    ? `${patient.user.firstName} ${patient.user.lastName}`
    : 'Patient';

  return (
    <SafeAreaView style={crmStyles.safe} edges={['top']}>
      <View style={crmStyles.navBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={crmStyles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={crmStyles.navTitle} numberOfLines={1}>{patientName}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={crmStyles.scroll} showsVerticalScrollIndicator={false}>
        {/* Patient header */}
        <View style={crmStyles.patientHeader}>
          <Avatar uri={patient?.avatarUrl} initials={patientName[0].toUpperCase()} size={52} fontSize={20} />
          <View>
            <Text style={crmStyles.patientName}>{patientName}</Text>
            <Text style={crmStyles.patientEmail}>{patient?.user.email ?? patient?.user.username}</Text>
          </View>
        </View>

        {/* Basic info */}
        {patient && (
          <View style={crmStyles.section}>
            <View style={crmStyles.sectionRow}>
              <Text style={crmStyles.sectionTitle}>BASIC INFO</Text>
              <TouchableOpacity onPress={() => router.push(`/edit-patient/${pid}`)}>
                <Text style={crmStyles.viewAll}>Edit</Text>
              </TouchableOpacity>
            </View>
            <View style={crmStyles.infoCard}>
              <InfoItem label="Age" value={ageFromDob(patient.dateOfBirth) !== null ? `${ageFromDob(patient.dateOfBirth)}` : '—'} />
              <InfoItem label="Gender" value={formatGender(patient.gender) ?? '—'} />
              <InfoItem label="Health issue" value={patient.healthIssue ?? '—'} />
            </View>
          </View>
        )}

        {/* Touch-base */}
        {patient && (
          <View style={crmStyles.section}>
            <View style={crmStyles.sectionRow}>
              <Text style={crmStyles.sectionTitle}>TOUCH-BASE</Text>
              <View style={crmStyles.toggleRow}>
                <Text style={crmStyles.toggleLabel}>
                  {patient.touchBaseRemindersPaused ? 'Reminders paused' : 'Reminders active'}
                </Text>
                <Switch
                  value={!patient.touchBaseRemindersPaused}
                  onValueChange={handleTogglePause}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#fff"
                />
              </View>
            </View>
            <View style={crmStyles.infoCard}>
              <View style={crmStyles.lastContactRow}>
                <View style={{ flex: 1 }}>
                  <Text style={crmStyles.infoLabel}>Last contact</Text>
                  <Text style={crmStyles.infoValue}>{formatLastContact(patient.lastContactAt)}</Text>
                </View>
                <TouchableOpacity
                  style={crmStyles.markContactedBtn}
                  disabled={markingContacted}
                  onPress={handleMarkContacted}
                >
                  <Feather name="heart" size={12} color={colors.primary} />
                  <Text style={crmStyles.markContactedText}>{markingContacted ? 'Saving…' : 'Mark as contacted'}</Text>
                </TouchableOpacity>
              </View>
              {STAFF_FEATURES_ENABLED && (
                <InfoItem
                  label="Provider"
                  value={(() => {
                    const provider = providers.find((p) => p.id === patient.providerId);
                    return provider ? `${provider.user.firstName} ${provider.user.lastName}` : 'Unassigned (all staff)';
                  })()}
                />
              )}

              {patient.touchBaseRemindersPaused && (
                <Text style={crmStyles.pausedNote}>
                  Reminders paused for this patient. Turn back on to resume.
                </Text>
              )}
              <>
                  <View style={crmStyles.infoRowNoBorder}>
                    <Text style={crmStyles.infoLabel}>Threshold</Text>
                    <Text style={crmStyles.infoValue}>
                      {patient.touchBaseThresholdDays ? `${formatThresholdDays(patient.touchBaseThresholdDays)} (custom)` : 'Global default'}
                    </Text>
                  </View>
                  <View style={{ marginTop: spacing.sm, marginBottom: spacing.sm }}>
                    <Dropdown
                      options={[
                        { value: 'default', label: 'Use default' },
                        ...(!TOUCH_BASE_THRESHOLD_PRESETS.some((p) => p.days === patient.touchBaseThresholdDays) && patient.touchBaseThresholdDays !== null
                          ? [{ value: String(patient.touchBaseThresholdDays), label: `${formatThresholdDays(patient.touchBaseThresholdDays)} (custom)` }]
                          : []),
                        ...TOUCH_BASE_THRESHOLD_PRESETS.map((preset) => ({ value: String(preset.days), label: preset.label })),
                      ]}
                      value={patient.touchBaseThresholdDays !== null ? String(patient.touchBaseThresholdDays) : 'default'}
                      onChange={(v) => handleSetThreshold(v === 'default' ? null : Number(v))}
                    />
                  </View>

                  {isAdmin && (
                    <View style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>
                      <Text style={[crmStyles.infoLabel, { marginBottom: spacing.xs }]}>Test threshold</Text>
                      <Dropdown
                        options={[
                          { value: '', label: 'Choose a test threshold…' },
                          ...TEST_THRESHOLD_PRESETS.map((preset) => ({ value: String(preset.days), label: preset.label })),
                        ]}
                        value={TEST_THRESHOLD_PRESETS.some((p) => p.days === patient.touchBaseThresholdDays) ? String(patient.touchBaseThresholdDays) : ''}
                        onChange={(v) => v && handleSetThreshold(Number(v))}
                      />
                    </View>
                  )}
                </>
            </View>
          </View>
        )}

        {/* Notes — pinned near the top since it's used most often */}
        <View style={crmStyles.quickLinks}>
          <QuickLink icon="📝" label="Notes" onPress={() => router.push(`/notes/${pid}`)} />
        </View>

        {/* Summary stats */}
        {summary && (
          <View style={crmStyles.section}>
            <Text style={crmStyles.sectionTitle}>SUMMARY</Text>
            <SummaryRow summary={summary} />
            <View style={crmStyles.photoCount}>
              <Text style={crmStyles.photoCountText}>
                📷 {summary.totalPhotos} progress photo{summary.totalPhotos !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        )}

        {/* Weight trend — is treatment moving the needle? */}
        {trend.length >= 2 && (
          <View style={crmStyles.section}>
            <WeightChart data={trend} />
          </View>
        )}

        {/* Quick links */}
        <View style={crmStyles.section}>
          <Text style={crmStyles.sectionTitle}>QUICK LINKS</Text>
          <View style={crmStyles.quickLinks}>
            <QuickLink icon="📈"  label="Health logs"    onPress={() => router.push(`/health-log/${pid}`)} />
            <QuickLink icon="⏰"  label="Peptides"    onPress={() => router.push(`/peptides/${pid}`)} />
            <QuickLink icon="🕐"  label="Full timeline"  onPress={() => router.push(`/history/${pid}`)} />
            <QuickLink icon="📷"  label="Progress photos" onPress={() => router.push(`/photos/${pid}`)} />
            <QuickLink icon="📄"  label="Documents" onPress={() => router.push(`/documents/${pid}`)} />
            <QuickLink icon="🗓️"  label="Appointments" onPress={() => router.push(`/appointments/${pid}`)} />
            <QuickLink icon="💬"  label="Messages" onPress={() => router.push(`/messages/${pid}`)} />
            <QuickLink icon="🧪"  label="Test/scan requests" onPress={() => router.push(`/test-requests/${pid}`)} />
            <QuickLink icon="🩺"  label="Health metrics" onPress={() => router.push(`/health-metrics/${pid}`)} />
          </View>
        </View>

        {/* Recent activity */}
        {timeline.length > 0 && (
          <View style={crmStyles.section}>
            <View style={crmStyles.sectionRow}>
              <Text style={crmStyles.sectionTitle}>RECENT ACTIVITY</Text>
              <TouchableOpacity onPress={() => router.push(`/history/${pid}`)}>
                <Text style={crmStyles.viewAll}>View all →</Text>
              </TouchableOpacity>
            </View>
            <View style={crmStyles.timelineCard}>
              {timeline.map((event, i) => (
                <View key={`${event.type}-${event.id}`}>
                  <MiniEventRow event={event} />
                  {i < timeline.length - 1 && <View style={crmStyles.divider} />}
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={crmStyles.deleteRow}>
          <TouchableOpacity style={crmStyles.deleteBtn} onPress={handleDeletePatient}>
            <Feather name="trash-2" size={13} color={colors.danger} />
            <Text style={crmStyles.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const crmStyles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg.app },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },

  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backText: { ...(typography.body1 as object), color: colors.primary },
  navTitle: { ...(typography.h4 as object), color: colors.text.primary, flex: 1, textAlign: 'center' },

  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  patientName:   { ...(typography.h4 as object), color: colors.text.primary },
  patientEmail:  { ...(typography.caption as object), color: colors.text.muted },

  section:     { gap: spacing.sm },
  sectionRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: {
    ...(typography.label as object),
    color: colors.text.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  viewAll: { ...(typography.label as object), color: colors.primary },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  toggleLabel: { ...(typography.caption as object), color: colors.text.secondary },
  lastContactRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: spacing.sm },
  markContactedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    backgroundColor: colors.primaryBg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  markContactedText: { ...(typography.label as object), color: colors.primary, fontWeight: '600' as const },
  infoRowNoBorder: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  pausedNote: { ...(typography.caption as object), color: colors.text.muted, paddingTop: spacing.xs, paddingBottom: spacing.sm },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap' as const, gap: spacing.sm },
  statCard: {
    flex: 1,
    minWidth: '40%' as unknown as number,
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
    ...shadows.sm,
  },
  statValue:  { ...(typography.h2 as object), color: colors.text.primary },
  statLabel:  { ...(typography.caption as object), color: colors.text.muted, textAlign: 'center' },
  trendArrow: { ...(typography.h3 as object), fontWeight: '700' as const },

  photoCount: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    ...shadows.sm,
  },
  photoCountText: { ...(typography.body2 as object), color: colors.text.secondary },

  infoCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    ...shadows.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: { ...(typography.label as object), color: colors.text.secondary },
  infoValue: { ...(typography.body2 as object), color: colors.text.primary, flexShrink: 1, textAlign: 'right', maxWidth: '60%' },

  quickLinks: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...shadows.sm,
  },
  quickLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  quickLinkIcon:  { fontSize: 18, width: 24, textAlign: 'center' as const },
  quickLinkLabel: { ...(typography.body2 as object), color: colors.text.primary, flex: 1 },
  quickLinkArrow: { ...(typography.h3 as object), color: colors.text.muted },

  timelineCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    ...shadows.sm,
  },
  miniEvent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  miniIcon:  { fontSize: 16, width: 20, textAlign: 'center' as const },
  miniTitle: { ...(typography.body2 as object), color: colors.text.primary, fontWeight: '500' as const },
  miniSub:   { ...(typography.caption as object), color: colors.text.secondary },
  miniTime:  { ...(typography.caption as object), color: colors.text.muted },
  divider:   { height: 1, backgroundColor: colors.border },

  deleteRow: { alignItems: 'flex-end', paddingVertical: spacing.sm },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  deleteBtnText: { ...(typography.label as object), color: colors.danger, fontWeight: '600' as const },
});
