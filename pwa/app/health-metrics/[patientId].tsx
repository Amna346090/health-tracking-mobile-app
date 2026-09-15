/**
 * Health metrics screen (cholesterol, LDL/HDL, triglycerides, blood glucose,
 * blood pressure, etc.) — distinct from the daily weight/height Health Log.
 * Patients (and staff, on the patient's behalf) can log a value, optionally
 * attaching a supporting report via the same DocumentPicker used for general
 * document uploads.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { colors, radius, shadows, spacing, typography } from '../../theme';
import { EmptyState } from '../../components/EmptyState';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { DateField } from '../../components/DateField';
import { MetricChart } from '../../components/MetricChart';
import { DocumentPicker } from '../../components/DocumentPicker';
import { useAuth } from '../../context/auth';
import {
  getMetrics,
  getMetricTrend,
  HEALTH_METRIC_TYPES,
  type HealthMetricType,
  type MetricTrendPoint,
} from '../../api/healthMetrics';
import type { Document } from '../../api/documents';
import {
  listHealthMetricsCached, mergeHealthMetricsFromServer, createHealthMetricOffline, isTempId,
  type OfflineHealthMetric as HealthMetric,
} from '../../offline/entities/healthMetrics';
import { sameData, sameList } from '../../offline/util';
import { cache, onCacheChanged } from '../../offline/cache';

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function HealthMetricsScreen() {
  const { t } = useTranslation();
  const metricTypeLabel = (type: HealthMetricType) => t(`healthMetrics.type.${type}`);
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const pidIsTemp = isTempId(patientId);
  const pid = pidIsTemp ? patientId : Number(patientId);
  const isOwnPatient = user?.role === 'PATIENT' && user.patientProfile?.id === pid;
  const isStaff = user?.role === 'STAFF' || user?.role === 'ADMIN';
  const canLog = isOwnPatient || isStaff;

  const [metricType, setMetricType] = useState<HealthMetricType>('CHOLESTEROL_LDL');
  const initialEntries = () => cache.listSync<HealthMetric>('healthMetrics').filter((m) => String(m.patientId) === String(pid) && m.type === 'CHOLESTEROL_LDL');
  const [entries, setEntries] = useState<HealthMetric[]>(initialEntries);
  const [trend, setTrend] = useState<MetricTrendPoint[]>([]);
  const [loading, setLoading] = useState(() => initialEntries().length === 0);
  const [showForm, setShowForm] = useState(false);
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('mg/dL');
  const [date, setDate] = useState(todayISO());
  const [attachedDoc, setAttachedDoc] = useState<Document | null>(null);

  const hasLoadedRef = useRef(false);

  const byRecordedDesc = (list: HealthMetric[]) => [...list].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));

  const refreshFromCache = useCallback(async (): Promise<number> => {
    const cached = byRecordedDesc((await listHealthMetricsCached(pid)).filter((m) => m.type === metricType));
    setEntries((prev) => (sameList(prev, cached) ? prev : cached));
    if (cached.length > 0) setLoading(false);
    return cached.length;
  }, [pid, metricType]);

  const load = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    await refreshFromCache();
    if (pidIsTemp) { setLoading(false); hasLoadedRef.current = true; return; }
    try {
      const [entriesData, trendData] = await Promise.all([
        getMetrics(pid as number, metricType),
        getMetricTrend(pid as number, metricType),
      ]);
      const merged = byRecordedDesc((await mergeHealthMetricsFromServer(pid, entriesData)).filter((m) => m.type === metricType));
      setEntries((prev) => (sameList(prev, merged) ? prev : merged));
      setTrend((prev) => (sameData(prev, trendData) ? prev : trendData));
    } catch {
      // offline or request failed — keep showing whatever was cached
    } finally {
      setLoading(false);
      hasLoadedRef.current = true;
    }
  }, [pid, pidIsTemp, metricType, refreshFromCache]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => onCacheChanged('healthMetrics', () => refreshFromCache()), [refreshFromCache]);

  // Saved locally and shown immediately; syncs to the server in the background.
  async function handleSave() {
    const parsed = parseFloat(value);
    if (isNaN(parsed) || !user) { Alert.alert(t('healthMetrics.invalidNumber')); return; }
    const metric = await createHealthMetricOffline(pid, {
      type: metricType,
      value: parsed,
      unit: unit.trim() || null,
      recordedAt: date,
      documentId: attachedDoc?.id ?? null,
    }, user.id);
    setEntries((prev) => [metric, ...prev]);
    setValue('');
    setAttachedDoc(null);
    setDate(todayISO());
    setShowForm(false);
  }

  const Header = (
    <View>
      <View style={styles.typeRow}>
        {HEALTH_METRIC_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.typeChip, metricType === type && styles.typeChipActive]}
            onPress={() => setMetricType(type)}
          >
            <Text style={[styles.typeChipText, metricType === type && styles.typeChipTextActive]}>
              {metricTypeLabel(type)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {canLog && (
        <TouchableOpacity
          style={[styles.addBtn, showForm && styles.addBtnActive]}
          onPress={() => setShowForm((v) => !v)}
          activeOpacity={0.8}
        >
          <Text style={[styles.addBtnText, showForm && styles.addBtnTextActive]}>
            {showForm ? '✕' : t('healthMetrics.logType', { type: metricTypeLabel(metricType) })}
          </Text>
        </TouchableOpacity>
      )}

      {showForm && (
        <Card style={styles.formCard}>
          {isStaff && !isOwnPatient && (
            <View style={styles.staffBanner}>
              <Text style={styles.staffBannerText}>{t('healthLogDetail.staffBanner')}</Text>
            </View>
          )}
          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.fieldLabel}>{t('healthMetrics.value')}</Text>
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={setValue}
                placeholder={t('healthMetrics.valuePlaceholder')}
                placeholderTextColor={colors.text.muted}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.half}>
              <Text style={styles.fieldLabel}>{t('healthMetrics.unit')}</Text>
              <TextInput
                style={styles.input}
                value={unit}
                onChangeText={setUnit}
                placeholder={t('healthMetrics.unitPlaceholder')}
                placeholderTextColor={colors.text.muted}
              />
            </View>
          </View>
          <DateField label={t('healthLog.date')} value={date} onChange={setDate} maximumDate={new Date()} />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('healthMetrics.supportingReportOptional')}</Text>
            {attachedDoc ? (
              <View style={styles.attachedDoc}>
                <Text style={styles.attachedDocText}>{t('healthMetrics.reportAttached')}</Text>
                <TouchableOpacity onPress={() => setAttachedDoc(null)}>
                  <Text style={styles.removeAttachment}>{t('common.remove')}</Text>
                </TouchableOpacity>
              </View>
            ) : !pidIsTemp ? (
              <DocumentPicker patientId={pid as number} onUploaded={setAttachedDoc} />
            ) : null}
          </View>

          <Button label={t('healthMetrics.saveEntry')} onPress={handleSave} />
        </Card>
      )}

      {trend.length >= 2 && (
        <MetricChart data={trend} label={metricTypeLabel(metricType)} />
      )}

      {entries.length > 0 && <Text style={styles.sectionTitle}>{t('healthLog.history')}</Text>}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>{t('common.backWithArrow')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('patientDashboard.healthMetrics')}</Text>
        <View style={{ width: 50 }} />
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={Header}
        ListEmptyComponent={
          !showForm ? (
            <EmptyState
              icon="🩸"
              title={t('healthMetrics.noEntriesTitle')}
              subtitle={canLog ? t('healthMetrics.tapAboveToLog', { type: metricTypeLabel(metricType) }) : t('healthMetrics.noEntriesLogged')}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <Card style={styles.entryCard}>
            <Text style={styles.entryValue}>{item.value} {item.unit ?? ''}</Text>
            <Text style={styles.entryMeta}>
              {formatDate(item.recordedAt, t('language.locale'))}{item.documentId ? t('healthMetrics.linkedToReport') : ''}
            </Text>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.app },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },

  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  typeChip: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg.card,
  },
  typeChipActive: { backgroundColor: colors.primaryBg, borderColor: colors.primary },
  typeChipText: { ...typography.caption, color: colors.text.secondary, fontWeight: '600' as const },
  typeChipTextActive: { color: colors.primary },

  addBtn: {
    backgroundColor: colors.primaryBg,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: spacing.md,
  },
  addBtnActive: { backgroundColor: colors.bg.subtle, borderColor: colors.border },
  addBtnText: { ...typography.label, color: colors.primary, fontWeight: '600' as const },
  addBtnTextActive: { color: colors.text.secondary },

  formCard: { gap: spacing.md, marginBottom: spacing.md },
  staffBanner: {
    backgroundColor: colors.warningBg,
    borderRadius: radius.sm,
    padding: spacing.sm,
    alignItems: 'center',
  },
  staffBannerText: { ...typography.caption, color: colors.warning, fontWeight: '600' as const },
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1, gap: spacing.xs },
  field: { gap: spacing.xs },
  fieldLabel: { ...typography.label, color: colors.text.secondary },
  input: {
    backgroundColor: colors.bg.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body2,
    color: colors.text.primary,
  },
  attachedDoc: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.successBg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  attachedDocText: { ...typography.body2, color: colors.success, fontWeight: '600' as const },
  removeAttachment: { ...typography.label, color: colors.text.muted },

  sectionTitle: { ...typography.h4, color: colors.text.primary, marginBottom: spacing.sm },
  entryCard: { gap: 2 },
  entryValue: { ...typography.h4, color: colors.text.primary },
  entryMeta: { ...typography.caption, color: colors.text.muted },
});
