/**
 * Staff/admin view of a specific patient's health log.
 * Accessible via the Health Log tab → patient list.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { colors, radius, shadows, spacing, typography } from '../../theme';
import { EmptyState } from '../../components/EmptyState';
import { HealthLogCard } from '../../components/HealthLogCard';
import { WeightChart } from '../../components/WeightChart';
import { PullToRefreshIndicator } from '../../components/PullToRefreshIndicator';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { getHealthLogs, getWeightTrend, type WeightDataPoint } from '../../api/healthLog';
import { api } from '../../api/client';
import { FeelingPicker } from '../../components/FeelingPicker';
import { PhotoPicker } from '../../components/PhotoPicker';
import {
  TextInput,
} from 'react-native';
import { Alert } from '../../lib/alert';
import type { FeelingStatus } from '../../api/healthLog';
import {
  listHealthLogsCached, mergeHealthLogsFromServer, createHealthLogOffline, isTempId,
  type OfflineHealthLog as HealthLog,
} from '../../offline/entities/healthLog';
import { sameData, sameList } from '../../offline/util';
import { cache, onCacheChanged } from '../../offline/cache';
import { useAuth } from '../../context/auth';

const SCREEN_W = Dimensions.get('window').width;

interface PatientMeta {
  id: number;
  user: { firstName: string; lastName: string; email: string };
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export default function PatientHealthLogScreen() {
  const { t } = useTranslation();
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const pidIsTemp = isTempId(patientId);
  const pid = pidIsTemp ? patientId : Number(patientId);

  const initialLogs = () => cache.listSync<HealthLog>('healthLogs').filter((l) => String(l.patientId) === String(pid));
  const [patient,   setPatient]   = useState<PatientMeta | null>(null);
  const [logs,      setLogs]      = useState<HealthLog[]>(initialLogs);
  const [trend,     setTrend]     = useState<WeightDataPoint[]>([]);
  const [loading,   setLoading]   = useState(() => initialLogs().length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm,  setShowForm]  = useState(false);
  const [savedLogId, setSavedLogId] = useState<string | number | null>(null);

  // Form state
  const [date,    setDate]    = useState(todayISO);
  const [weight,  setWeight]  = useState('');
  const [height,  setHeight]  = useState('');
  const [feeling, setFeeling] = useState<FeelingStatus | null>(null);
  const [notes,   setNotes]   = useState('');

  const hasLoadedRef = useRef(false);

  const byDateDesc = (list: HealthLog[]) => [...list].sort((a, b) => b.date.localeCompare(a.date));

  const refreshFromCache = useCallback(async (): Promise<number> => {
    const cachedLogs = byDateDesc(await listHealthLogsCached(pid));
    setLogs((prev) => (sameList(prev, cachedLogs) ? prev : cachedLogs));
    if (cachedLogs.length > 0) setLoading(false);
    return cachedLogs.length;
  }, [pid]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else if (!hasLoadedRef.current) setLoading(true);
    await refreshFromCache();
    if (pidIsTemp) { setLoading(false); setRefreshing(false); hasLoadedRef.current = true; return; }
    try {
      const [patientData, logData, trendData] = await Promise.all([
        api.get<PatientMeta>(`/patients/${pid}`),
        getHealthLogs(pid as number, { limit: 50 }),
        getWeightTrend(pid as number, 60),
      ]);
      setPatient((prev) => (sameData(prev, patientData) ? prev : patientData));
      const mergedLogs = byDateDesc(await mergeHealthLogsFromServer(pid, logData));
      setLogs((prev) => (sameList(prev, mergedLogs) ? prev : mergedLogs));
      setTrend((prev) => (sameData(prev, trendData) ? prev : trendData));
    } catch {
      // offline or request failed — keep showing whatever was cached
    } finally {
      setLoading(false);
      setRefreshing(false);
      hasLoadedRef.current = true;
    }
  }, [pid, pidIsTemp, refreshFromCache]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => onCacheChanged('healthLogs', () => refreshFromCache()), [refreshFromCache]);

  const { pullProgress, scrollHandlers } = usePullToRefresh(() => load(true));

  // Saved locally and shown immediately (via the cache-change listener above — adding it
  // here too would race that listener and show it twice); syncs in the background.
  const handleSave = async () => {
    if (!date.trim() || !user) { Alert.alert(t('healthLog.dateRequired')); return; }
    const log = await createHealthLogOffline(pid, {
      date:    date.trim(),
      weight:  weight  ? parseFloat(weight)  : null,
      height:  height  ? parseFloat(height)  : null,
      feeling: feeling,
      notes:   notes.trim() || null,
    }, { id: user.id, firstName: user.firstName, lastName: user.lastName, role: user.role });
    if (log.weight) {
      const point = { date: log.date.split('T')[0], weight: log.weight };
      setTrend((prev) => [...prev, point].sort((a, b) => a.date.localeCompare(b.date)));
    }
    setDate(todayISO());
    setWeight(''); setHeight(''); setFeeling(null); setNotes('');
    setSavedLogId(log.id); // move to photo step
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  const patientName = patient
    ? `${patient.user.firstName} ${patient.user.lastName}`
    : t('patientDashboard.patientFallback');

  const Header = (
    <View>
      {/* Staff entry form */}
      {/* Photo-attachment step (appears after form is saved) */}
      {savedLogId !== null && (
        <View style={styles.formCard}>
          <Text style={styles.photoStepTitle}>{t('healthLogDetail.entrySavedAttachPhoto')}</Text>
          {/* Photo uploads need a live connection either way — skip this step for an entry
              that's still only local (temp id), same as if the admin just tapped Skip. */}
          {!pidIsTemp && !isTempId(savedLogId) && (
            <PhotoPicker
              patientId={pid as number}
              healthLogId={savedLogId as number}
              onUploaded={() => { setSavedLogId(null); setShowForm(false); }}
            />
          )}
          <TouchableOpacity style={styles.skipBtn} onPress={() => { setSavedLogId(null); setShowForm(false); }}>
            <Text style={styles.skipBtnText}>{t('healthLog.skip')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {showForm && savedLogId === null && (
        <View style={styles.formCard}>
          <View style={styles.staffBanner}>
            <Text style={styles.staffBannerText}>{t('healthLogDetail.staffBanner')}</Text>
          </View>

          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.fieldLabel}>{t('healthLog.date')}</Text>
              <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder={t('healthLog.datePlaceholder')} placeholderTextColor={colors.text.muted} />
            </View>
            <View style={styles.half}>
              <Text style={styles.fieldLabel}>{t('healthLog.weightKg')}</Text>
              <TextInput style={styles.input} value={weight} onChangeText={setWeight} placeholder={t('healthLog.weightPlaceholder')} placeholderTextColor={colors.text.muted} keyboardType="decimal-pad" />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('healthLog.heightCm')}</Text>
            <TextInput style={styles.input} value={height} onChangeText={setHeight} placeholder={t('healthLog.heightPlaceholder')} placeholderTextColor={colors.text.muted} keyboardType="decimal-pad" />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('healthLogDetail.howFeelingPatient')}</Text>
            <FeelingPicker value={feeling} onChange={setFeeling} />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('healthLog.notes')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('healthLogDetail.observationsPlaceholder')}
              placeholderTextColor={colors.text.muted}
              multiline
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
            <Text style={styles.saveBtnText}>{t('healthLog.saveEntry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {trend.length >= 2 && (
        <WeightChart data={trend} width={SCREEN_W - spacing.lg * 2} />
      )}

      {logs.length > 0 && (
        <Text style={styles.sectionTitle}>{t('healthLog.history')}</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PullToRefreshIndicator pullProgress={pullProgress} refreshing={refreshing} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Nav bar */}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>{t('common.backWithArrow')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addBtn, showForm && styles.addBtnActive]}
            onPress={() => setShowForm((v) => !v)}
            activeOpacity={0.8}
          >
            <Text style={[styles.addBtnText, showForm && styles.addBtnTextActive]}>
              {showForm ? '✕' : t('healthLogDetail.addEntry')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Patient name */}
        <View style={styles.patientHeader}>
          <Text style={styles.patientName}>{patientName}</Text>
          {patient?.user.email && (
            <Text style={styles.patientEmail}>{patient.user.email}</Text>
          )}
        </View>

        <FlatList
          data={logs}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={Header}
          {...scrollHandlers}
          renderItem={({ item }) => <HealthLogCard log={item} />}
          ListEmptyComponent={
            !showForm
              ? <EmptyState icon="📈" title={t('healthLogDetail.noLogsTitle')} subtitle={t('healthLogDetail.noLogsSubtitle')} />
              : null
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg.app, position: 'relative' },
  flex:   { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:   { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  backBtn:  {},
  backText: { ...(typography.body1 as object), color: colors.primary },
  addBtn: {
    backgroundColor: colors.primaryBg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  addBtnActive: { backgroundColor: colors.bg.subtle, borderColor: colors.border },
  addBtnText: { ...(typography.label as object), color: colors.primary, fontWeight: '600' as const },
  addBtnTextActive: { color: colors.text.secondary },

  patientHeader: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  patientName:  { ...(typography.h2 as object), color: colors.text.primary },
  patientEmail: { ...(typography.body2 as object), color: colors.text.muted },

  sectionTitle: { ...(typography.h4 as object), color: colors.text.primary, marginBottom: spacing.sm },

  // Form
  formCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
    ...shadows.sm,
  },
  staffBanner: {
    backgroundColor: colors.warningBg,
    borderRadius: radius.sm,
    padding: spacing.sm,
    alignItems: 'center',
  },
  staffBannerText: {
    ...(typography.caption as object),
    color: colors.warning,
    fontWeight: '600' as const,
  },
  row:   { flexDirection: 'row', gap: spacing.md },
  half:  { flex: 1, gap: spacing.xs },
  field: { gap: spacing.xs },
  fieldLabel: { ...(typography.label as object), color: colors.text.secondary },
  input: {
    backgroundColor: colors.bg.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...(typography.body2 as object),
    color: colors.text.primary,
  },
  textArea: { minHeight: 72, paddingTop: spacing.sm },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    ...(typography.body1 as object),
    fontWeight: '600' as const,
    color: colors.text.inverse,
  },
  photoStepTitle: { ...(typography.h4 as object), color: colors.text.primary },
  skipBtn:      { alignItems: 'center', paddingVertical: spacing.xs },
  skipBtnText:  { ...(typography.label as object), color: colors.text.muted },
});
