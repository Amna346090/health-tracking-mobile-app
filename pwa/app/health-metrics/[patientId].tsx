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
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
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
  createMetric,
  HEALTH_METRIC_TYPE_LABEL,
  HEALTH_METRIC_TYPES,
  type HealthMetric,
  type HealthMetricType,
  type MetricTrendPoint,
} from '../../api/healthMetrics';
import type { Document } from '../../api/documents';

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function HealthMetricsScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const pid = Number(patientId);
  const isOwnPatient = user?.role === 'PATIENT' && user.patientProfile?.id === pid;
  const isStaff = user?.role === 'STAFF' || user?.role === 'ADMIN';
  const canLog = isOwnPatient || isStaff;

  const [metricType, setMetricType] = useState<HealthMetricType>('CHOLESTEROL_LDL');
  const [entries, setEntries] = useState<HealthMetric[]>([]);
  const [trend, setTrend] = useState<MetricTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('mg/dL');
  const [date, setDate] = useState(todayISO());
  const [attachedDoc, setAttachedDoc] = useState<Document | null>(null);
  const [saving, setSaving] = useState(false);

  const hasLoadedRef = useRef(false);

  const load = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const [entriesData, trendData] = await Promise.all([
        getMetrics(pid, metricType),
        getMetricTrend(pid, metricType),
      ]);
      setEntries(entriesData);
      setTrend(trendData);
    } catch {
      // keep state
    } finally {
      setLoading(false);
      hasLoadedRef.current = true;
    }
  }, [pid, metricType]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleSave() {
    const parsed = parseFloat(value);
    if (isNaN(parsed)) { Alert.alert('Enter a valid number'); return; }
    setSaving(true);
    try {
      const metric = await createMetric(pid, {
        type: metricType,
        value: parsed,
        unit: unit.trim() || null,
        recordedAt: date,
        documentId: attachedDoc?.id ?? null,
      });
      setEntries((prev) => [metric, ...prev]);
      setValue('');
      setAttachedDoc(null);
      setDate(todayISO());
      setShowForm(false);
      load();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
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
              {HEALTH_METRIC_TYPE_LABEL[type]}
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
            {showForm ? '✕' : `+ Log ${HEALTH_METRIC_TYPE_LABEL[metricType]}`}
          </Text>
        </TouchableOpacity>
      )}

      {showForm && (
        <Card style={styles.formCard}>
          {isStaff && !isOwnPatient && (
            <View style={styles.staffBanner}>
              <Text style={styles.staffBannerText}>Staff entry — logged on patient's behalf</Text>
            </View>
          )}
          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.fieldLabel}>Value</Text>
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={setValue}
                placeholder="e.g. 105"
                placeholderTextColor={colors.text.muted}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.half}>
              <Text style={styles.fieldLabel}>Unit</Text>
              <TextInput
                style={styles.input}
                value={unit}
                onChangeText={setUnit}
                placeholder="e.g. mg/dL"
                placeholderTextColor={colors.text.muted}
              />
            </View>
          </View>
          <DateField label="Date" value={date} onChange={setDate} maximumDate={new Date()} />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Supporting report (optional)</Text>
            {attachedDoc ? (
              <View style={styles.attachedDoc}>
                <Text style={styles.attachedDocText}>Report attached ✓</Text>
                <TouchableOpacity onPress={() => setAttachedDoc(null)}>
                  <Text style={styles.removeAttachment}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <DocumentPicker patientId={pid} onUploaded={setAttachedDoc} />
            )}
          </View>

          <Button
            label={saving ? 'Saving…' : 'Save entry'}
            onPress={handleSave}
            loading={saving}
          />
        </Card>
      )}

      {trend.length >= 2 && (
        <MetricChart data={trend} label={HEALTH_METRIC_TYPE_LABEL[metricType]} />
      )}

      {entries.length > 0 && <Text style={styles.sectionTitle}>History</Text>}
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
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Health Metrics</Text>
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
              title="No entries yet"
              subtitle={canLog ? `Tap above to log ${HEALTH_METRIC_TYPE_LABEL[metricType]}.` : 'No entries logged yet.'}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <Card style={styles.entryCard}>
            <Text style={styles.entryValue}>{item.value} {item.unit ?? ''}</Text>
            <Text style={styles.entryMeta}>
              {formatDate(item.recordedAt)}{item.documentId ? ' · Linked to a report' : ''}
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
