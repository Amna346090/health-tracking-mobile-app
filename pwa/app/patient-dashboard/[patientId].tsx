import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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
import { getUploadHistory, type UploadAuditLogEntry } from '../../api/uploadAudit';

const UPLOAD_ACTION_ICON: Record<UploadAuditLogEntry['action'], string> = {
  UPLOADED: '⬆️',
  EDITED: '✏️',
  DELETED: '🗑️',
};

function uploadActionKey(entry: UploadAuditLogEntry): string {
  const entity = entry.entityType.toLowerCase() === 'photo' ? 'photo' : 'document';
  const action = entry.action.toLowerCase();
  return `patientDashboard.uploadAction.${entity}_${action}`;
}

function UploadHistoryRow({ entry, t }: { entry: UploadAuditLogEntry; t: TFunction }) {
  return (
    <View style={crmStyles.miniEvent}>
      <Text style={crmStyles.miniIcon}>{UPLOAD_ACTION_ICON[entry.action]}</Text>
      <View style={{ flex: 1 }}>
        <Text style={crmStyles.miniTitle}>
          {entry.performedBy.firstName} {entry.performedBy.lastName} {t(uploadActionKey(entry))}
        </Text>
        {entry.detail && <Text style={crmStyles.miniSub}>{entry.detail}</Text>}
      </View>
      <Text style={crmStyles.miniTime}>
        {new Date(entry.createdAt).toLocaleDateString(t('language.locale'), { month: 'short', day: 'numeric' })}
      </Text>
    </View>
  );
}

interface PatientMeta {
  id: number;
  user: { id: number; firstName: string; lastName: string; email: string | null; username: string | null };
  dateOfBirth: string | null;
  gender: string | null;
  healthIssue: string | null;
  avatarUrl: string | null;
  phone: string | null;
  lastContactAt: string | null;
  providerId: number | null;
  touchBaseThresholdDays: number | null;
  touchBaseRemindersPaused: boolean;
}

const TOUCH_BASE_THRESHOLD_PRESETS: { days: number }[] = [
  { days: 7 },
  { days: 14 },
  { days: 30 },
  { days: 60 },
  { days: 90 },
];

// Admin-only, for verifying the reminder pipeline actually fires without waiting days/weeks.
const TEST_THRESHOLD_PRESETS: { days: number }[] = [
  { days: 1 / 1440 },
  { days: 5 / 1440 },
  { days: 10 / 1440 },
];

function formatThresholdDays(days: number, t: TFunction): string {
  if (days < 1) return t('touchBase.thresholdMin', { count: Math.round(days * 1440) });
  return t('touchBase.thresholdDays', { count: days });
}

function formatLastContact(iso: string | null, t: TFunction): string {
  if (!iso) return t('patientDashboard.never');
  return new Date(iso).toLocaleDateString(t('language.locale'), { month: 'short', day: 'numeric', year: 'numeric' });
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

function formatGender(gender: string | null, t: TFunction): string | null {
  if (!gender) return null;
  if (gender === 'PREFER_NOT_TO_SAY') return t('profile.preferNotToSay');
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

function SummaryRow({ summary, t }: { summary: PatientSummary; t: TFunction }) {
  const trendSymbol = summary.weight.trend ? TREND_ARROW[summary.weight.trend] : null;
  const trendColor  = summary.weight.trend === 'UP'
    ? (colors.danger ?? '#ef4444')
    : summary.weight.trend === 'DOWN'
    ? (colors.success ?? '#22c55e')
    : colors.text.muted;

  return (
    <View style={crmStyles.statsRow}>
      <AdherenceBadge rate={summary.adherence.last7d.rate}  label={t('patientDashboard.sevenDayAdherence')} />
      <AdherenceBadge rate={summary.adherence.last30d.rate} label={t('patientDashboard.thirtyDayAdherence')} />
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
          {summary.weight.latest !== null ? t('patientDashboard.kgWeight') : t('patientDashboard.noWeightData')}
        </Text>
      </View>
      <View style={crmStyles.statCard}>
        <Text style={crmStyles.statValue}>
          {summary.daysSinceLastLog !== null ? String(summary.daysSinceLastLog) : '—'}
        </Text>
        <Text style={crmStyles.statLabel}>
          {summary.daysSinceLastLog === 0 ? t('patientDashboard.loggedToday') : t('patientDashboard.daysSinceLog')}
        </Text>
      </View>
    </View>
  );
}

// ─── Mini timeline event row ──────────────────────────────────────────────────

function MiniEventRow({ event, t }: { event: TimelineEvent; t: TFunction }) {
  let icon = '•';
  let title = '';
  let sub = '';

  if (event.type === 'MEDICATION_LOG') {
    icon = event.status === 'TAKEN' ? '✅' : event.status === 'MISSED' ? '❌' : '⏭';
    title = event.medication.name;
    sub   = t(`medications.status.${event.status.toLowerCase()}`);
  } else if (event.type === 'HEALTH_LOG') {
    const emoji = event.feeling ? FEELING_EMOJI[event.feeling as FeelingStatus] : '';
    icon  = '📋';
    title = t('patientDashboard.healthLogTitle');
    sub   = [event.weight ? `${event.weight} kg` : null, emoji].filter(Boolean).join(' · ') || t('patientDashboard.recorded');
  } else {
    icon  = '📷';
    title = t('patientDashboard.photoTitle');
    sub   = event.caption ?? t('patientDashboard.noCaption');
  }

  return (
    <View style={crmStyles.miniEvent}>
      <Text style={crmStyles.miniIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={crmStyles.miniTitle}>{title}</Text>
        <Text style={crmStyles.miniSub}>{sub}</Text>
      </View>
      <Text style={crmStyles.miniTime}>
        {new Date(event.timestamp).toLocaleDateString(t('language.locale'), { month: 'short', day: 'numeric' })}
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
  const { t } = useTranslation();
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
  const [uploadHistory, setUploadHistory] = useState<UploadAuditLogEntry[]>([]);

  const load = useCallback(() => {
    return Promise.all([
      api.get<PatientMeta>(`/patients/${pid}`),
      getSummary(pid),
      getTimeline(pid, { limit: 5 }),
      getWeightTrend(pid, 30),
    ])
      .then(([p, s, t, w]) => { setPatient(p); setSummary(s); setTimeline(t); setTrend(w); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pid]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (STAFF_FEATURES_ENABLED) getAllProviders().then(setProviders).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => {
    if (isAdmin) getUploadHistory(pid).then(setUploadHistory).catch(() => {});
  }, [isAdmin, pid]));

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
      t('patientDashboard.deletePatientTitle'),
      t('patientDashboard.deletePatientBody', { name: `${patient.user.firstName} ${patient.user.lastName}` }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
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
    : t('patientDashboard.patientFallback');

  return (
    <SafeAreaView style={crmStyles.safe} edges={['top']}>
      <View style={crmStyles.navBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={crmStyles.backText}>{t('common.backWithArrow')}</Text>
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
            {isAdmin && patient && (
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: '/patient-credentials/[patientId]',
                    params: { patientId: String(pid), userId: String(patient.user.id), name: patientName },
                  })
                }
              >
                <Text style={crmStyles.credentialsLink}>{t('profile.viewLoginCredentials')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Phone / call */}
        {patient?.phone && (
          <View style={crmStyles.contactBar}>
            <View>
              <Text style={crmStyles.contactLabel}>{t('patientDashboard.phone')}</Text>
              <Text style={crmStyles.contactValue}>{patient.phone}</Text>
            </View>
            {React.createElement(
              'a',
              { href: `tel:${patient.phone}`, style: { textDecoration: 'none' } },
              <View style={crmStyles.callBtn}>
                <Feather name="phone" size={15} color={colors.text.inverse} />
                <Text style={crmStyles.callBtnText}>{t('patientDashboard.call')}</Text>
              </View>,
            )}
          </View>
        )}

        {/* Basic info */}
        {patient && (
          <View style={crmStyles.section}>
            <View style={crmStyles.sectionRow}>
              <Text style={crmStyles.sectionTitle}>{t('patientDashboard.basicInfo')}</Text>
              <TouchableOpacity onPress={() => router.push(`/edit-patient/${pid}`)}>
                <Text style={crmStyles.viewAll}>{t('common.edit')}</Text>
              </TouchableOpacity>
            </View>
            <View style={crmStyles.infoCard}>
              <InfoItem label={t('profile.age')} value={ageFromDob(patient.dateOfBirth) !== null ? `${ageFromDob(patient.dateOfBirth)}` : '—'} />
              <InfoItem label={t('profile.gender')} value={formatGender(patient.gender, t) ?? '—'} />
              <InfoItem label={t('profile.healthIssue')} value={patient.healthIssue ?? '—'} />
            </View>
          </View>
        )}

        {/* Touch-base */}
        {patient && (
          <View style={crmStyles.section}>
            <View style={crmStyles.sectionRow}>
              <Text style={crmStyles.sectionTitle}>{t('patientDashboard.touchBaseSection')}</Text>
              <View style={crmStyles.toggleRow}>
                <Text style={crmStyles.toggleLabel}>
                  {patient.touchBaseRemindersPaused ? t('patientDashboard.remindersPaused') : t('patientDashboard.remindersActive')}
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
                  <Text style={crmStyles.infoLabel}>{t('patientDashboard.lastContact')}</Text>
                  <Text style={crmStyles.infoValue}>{formatLastContact(patient.lastContactAt, t)}</Text>
                </View>
                <TouchableOpacity
                  style={crmStyles.markContactedBtn}
                  disabled={markingContacted}
                  onPress={handleMarkContacted}
                >
                  <Feather name="heart" size={12} color={colors.primary} />
                  <Text style={crmStyles.markContactedText}>{markingContacted ? t('appointments.saving') : t('touchBase.markAsContacted')}</Text>
                </TouchableOpacity>
              </View>
              {STAFF_FEATURES_ENABLED && (
                <InfoItem
                  label={t('patientDashboard.provider')}
                  value={(() => {
                    const provider = providers.find((p) => p.id === patient.providerId);
                    return provider ? `${provider.user.firstName} ${provider.user.lastName}` : t('patientDashboard.unassigned');
                  })()}
                />
              )}

              {patient.touchBaseRemindersPaused && (
                <Text style={crmStyles.pausedNote}>
                  {t('patientDashboard.pausedNote')}
                </Text>
              )}
              <>
                  <View style={crmStyles.infoRowNoBorder}>
                    <Text style={crmStyles.infoLabel}>{t('patientDashboard.threshold')}</Text>
                    <Text style={crmStyles.infoValue}>
                      {patient.touchBaseThresholdDays ? `${formatThresholdDays(patient.touchBaseThresholdDays, t)} ${t('patientDashboard.customSuffix')}` : t('patientDashboard.globalDefault')}
                    </Text>
                  </View>
                  <View style={{ marginTop: spacing.sm, marginBottom: spacing.sm }}>
                    <Dropdown
                      options={[
                        { value: 'default', label: t('patientDashboard.useDefault') },
                        ...(!TOUCH_BASE_THRESHOLD_PRESETS.some((p) => p.days === patient.touchBaseThresholdDays) && patient.touchBaseThresholdDays !== null
                          ? [{ value: String(patient.touchBaseThresholdDays), label: `${formatThresholdDays(patient.touchBaseThresholdDays, t)} ${t('patientDashboard.customSuffix')}` }]
                          : []),
                        ...TOUCH_BASE_THRESHOLD_PRESETS.map((preset) => ({ value: String(preset.days), label: formatThresholdDays(preset.days, t) })),
                      ]}
                      value={patient.touchBaseThresholdDays !== null ? String(patient.touchBaseThresholdDays) : 'default'}
                      onChange={(v) => handleSetThreshold(v === 'default' ? null : Number(v))}
                    />
                  </View>

                  {isAdmin && (
                    <View style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>
                      <Text style={[crmStyles.infoLabel, { marginBottom: spacing.xs }]}>{t('patientDashboard.testThreshold')}</Text>
                      <Dropdown
                        options={[
                          { value: '', label: t('patientDashboard.chooseTestThreshold') },
                          ...TEST_THRESHOLD_PRESETS.map((preset) => ({ value: String(preset.days), label: formatThresholdDays(preset.days, t) })),
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
          <QuickLink icon="📝" label={t('healthLog.notes')} onPress={() => router.push(`/notes/${pid}`)} />
        </View>

        {/* Summary stats */}
        {summary && (
          <View style={crmStyles.section}>
            <Text style={crmStyles.sectionTitle}>{t('patientDashboard.summary')}</Text>
            <SummaryRow summary={summary} t={t} />
            <View style={crmStyles.photoCount}>
              <Text style={crmStyles.photoCountText}>
                📷 {t('patientDashboard.progressPhotosCount', { count: summary.totalPhotos })}
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
          <Text style={crmStyles.sectionTitle}>{t('patientDashboard.quickLinks')}</Text>
          <View style={crmStyles.quickLinks}>
            <QuickLink icon="📈"  label={t('patientDashboard.healthLogsLink')}    onPress={() => router.push(`/health-log/${pid}`)} />
            <QuickLink icon="⏰"  label={t('dashboard.peptides')}    onPress={() => router.push(`/peptides/${pid}`)} />
            <QuickLink icon="🕐"  label={t('patientDashboard.fullTimeline')}  onPress={() => router.push(`/history/${pid}`)} />
            <QuickLink icon="📷"  label={t('patientDashboard.progressPhotosLink')} onPress={() => router.push(`/photos/${pid}`)} />
            <QuickLink icon="📄"  label={t('patientDashboard.documents')} onPress={() => router.push(`/documents/${pid}`)} />
            <QuickLink icon="🗓️"  label={t('dashboard.appointments')} onPress={() => router.push(`/appointments/${pid}`)} />
            <QuickLink icon="💬"  label={t('patientDashboard.messages')} onPress={() => router.push(`/messages/${pid}`)} />
            <QuickLink icon="🧪"  label={t('dashboard.testRequests')} onPress={() => router.push(`/test-requests/${pid}`)} />
            <QuickLink icon="🩺"  label={t('patientDashboard.healthMetrics')} onPress={() => router.push(`/health-metrics/${pid}`)} />
          </View>
        </View>

        {/* Upload history (admin-only) */}
        {isAdmin && (
          <View style={crmStyles.section}>
            <Text style={crmStyles.sectionTitle}>{t('patientDashboard.uploadHistory')}</Text>
            {uploadHistory.length === 0 ? (
              <Text style={crmStyles.emptyText}>{t('patientDashboard.noUploadActivity')}</Text>
            ) : (
              <View style={crmStyles.timelineCard}>
                {uploadHistory.map((entry, i) => (
                  <View key={entry.id}>
                    <UploadHistoryRow entry={entry} t={t} />
                    {i < uploadHistory.length - 1 && <View style={crmStyles.divider} />}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Recent activity */}
        {timeline.length > 0 && (
          <View style={crmStyles.section}>
            <View style={crmStyles.sectionRow}>
              <Text style={crmStyles.sectionTitle}>{t('patientDashboard.recentActivity')}</Text>
              <TouchableOpacity onPress={() => router.push(`/history/${pid}`)}>
                <Text style={crmStyles.viewAll}>{t('profile.viewAll')}</Text>
              </TouchableOpacity>
            </View>
            <View style={crmStyles.timelineCard}>
              {timeline.map((event, i) => (
                <View key={`${event.type}-${event.id}`}>
                  <MiniEventRow event={event} t={t} />
                  {i < timeline.length - 1 && <View style={crmStyles.divider} />}
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={crmStyles.deleteRow}>
          <TouchableOpacity style={crmStyles.deleteBtn} onPress={handleDeletePatient}>
            <Feather name="trash-2" size={13} color={colors.danger} />
            <Text style={crmStyles.deleteBtnText}>{t('common.delete')}</Text>
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
  credentialsLink: { ...(typography.caption as object), color: colors.primary, marginTop: 2 },

  contactBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    ...shadows.sm,
  },
  contactLabel: {
    ...(typography.caption as object),
    fontWeight: '600' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    color: colors.text.muted,
  },
  contactValue: { ...(typography.body1 as object), fontWeight: '600' as const, color: colors.text.primary, marginTop: 2 },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingVertical: spacing.xs + 1,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  callBtnText: { ...(typography.body2 as object), fontWeight: '600' as const, color: colors.text.inverse },

  section:     { gap: spacing.sm },
  sectionRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: {
    ...(typography.label as object),
    color: colors.text.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  viewAll: { ...(typography.label as object), color: colors.primary },
  emptyText: { ...(typography.body2 as object), color: colors.text.muted },

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
