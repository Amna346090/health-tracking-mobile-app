import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
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

interface PatientMeta {
  id: number;
  user: { firstName: string; lastName: string; email: string };
  dateOfBirth: string;
  gender: string | null;
  healthIssue: string | null;
  avatarUrl: string | null;
}

function ageFromDob(iso: string): number {
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

  const [patient,  setPatient]  = useState<PatientMeta | null>(null);
  const [summary,  setSummary]  = useState<PatientSummary | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [trend,    setTrend]    = useState<WeightDataPoint[]>([]);
  const [loading,  setLoading]  = useState(true);

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
            <Text style={crmStyles.patientEmail}>{patient?.user.email}</Text>
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
              <InfoItem label="Age" value={`${ageFromDob(patient.dateOfBirth)}`} />
              <InfoItem label="Gender" value={formatGender(patient.gender) ?? '—'} />
              <InfoItem label="Health issue" value={patient.healthIssue ?? '—'} />
            </View>
          </View>
        )}

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
            <QuickLink icon="⏰"  label="Medications"    onPress={() => router.push(`/assignment/${pid}`)} />
            <QuickLink icon="🕐"  label="Full timeline"  onPress={() => router.push(`/history/${pid}`)} />
            <QuickLink icon="📷"  label="Progress photos" onPress={() => router.push(`/photos/${pid}`)} />
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
});
