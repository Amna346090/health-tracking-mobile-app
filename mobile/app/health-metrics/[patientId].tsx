/**
 * Measurements screen — track any numeric value over time (weight, waist, resting
 * heart rate, sleep hours, …). Categories are free-text and per-client: staff or the
 * client type a name, then log values against it. Each category gets its own chart
 * and history. A supporting report can be attached via the shared DocumentPicker.
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
  getMetricTypes,
  getMetricTrend,
  createMetric,
  type HealthMetric,
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

  const [categories, setCategories] = useState<string[]>([]);
  const [metricType, setMetricType] = useState<string | null>(null);
  const [entries, setEntries] = useState<HealthMetric[]>([]);
  const [trend, setTrend] = useState<MetricTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const [showNewCat, setShowNewCat] = useState(false);
  const [newCat, setNewCat] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [date, setDate] = useState(todayISO());
  const [attachedDoc, setAttachedDoc] = useState<Document | null>(null);
  const [saving, setSaving] = useState(false);

  const hasLoadedRef = useRef(false);

  const loadCategories = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const cats = await getMetricTypes(pid);
      setCategories(cats);
      setMetricType((cur) => (cur && cats.includes(cur) ? cur : cats[0] ?? null));
    } catch {
      // keep state
    } finally {
      setLoading(false);
      hasLoadedRef.current = true;
    }
  }, [pid]);

  useFocusEffect(useCallback(() => { loadCategories(); }, [loadCategories]));

  const reloadEntries = useCallback(async (type: string) => {
    const [entriesData, trendData] = await Promise.all([
      getMetrics(pid, type),
      getMetricTrend(pid, type),
    ]);
    setEntries(entriesData);
    setTrend(trendData);
  }, [pid]);

  useEffect(() => {
    if (!metricType) {
      setEntries([]);
      setTrend([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [entriesData, trendData] = await Promise.all([
          getMetrics(pid, metricType),
          getMetricTrend(pid, metricType),
        ]);
        if (!cancelled) {
          setEntries(entriesData);
          setTrend(trendData);
        }
      } catch {
        // keep state
      }
    })();
    return () => { cancelled = true; };
  }, [pid, metricType]);

  function handleAddCategory() {
    const name = newCat.trim();
    if (!name) return;
    setCategories((prev) => (prev.includes(name) ? prev : [...prev, name].sort()));
    setMetricType(name);
    setNewCat('');
    setShowNewCat(false);
    setShowForm(true);
  }

  async function handleSave() {
    if (!metricType) return;
    const parsed = parseFloat(value);
    if (isNaN(parsed)) { Alert.alert('Enter a valid number'); return; }
    setSaving(true);
    try {
      await createMetric(pid, {
        type: metricType,
        value: parsed,
        unit: unit.trim() || null,
        recordedAt: date,
        documentId: attachedDoc?.id ?? null,
      });
      setValue('');
      setAttachedDoc(null);
      setDate(todayISO());
      setShowForm(false);
      await loadCategories();
      await reloadEntries(metricType);
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const Header = (
    <View>
      <View style={styles.typeRow}>
        {categories.map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.typeChip, metricType === type && styles.typeChipActive]}
            onPress={() => { setMetricType(type); setShowNewCat(false); }}
          >
            <Text style={[styles.typeChipText, metricType === type && styles.typeChipTextActive]}>
              {type}
            </Text>
          </TouchableOpacity>
        ))}
        {canLog && (
          <TouchableOpacity
            style={[styles.typeChip, styles.newChip, showNewCat && styles.typeChipActive]}
            onPress={() => { setShowNewCat((v) => !v); setShowForm(false); }}
          >
            <Text style={[styles.typeChipText, styles.newChipText, showNewCat && styles.typeChipTextActive]}>
              + New
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {showNewCat && (
        <View style={styles.newCatRow}>
          <TextInput
            style={[styles.input, styles.newCatInput]}
            value={newCat}
            onChangeText={setNewCat}
            placeholder="New category name"
            placeholderTextColor={colors.text.muted}
            autoFocus
            onSubmitEditing={handleAddCategory}
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.newCatAddBtn} onPress={handleAddCategory} activeOpacity={0.8}>
            <Text style={styles.newCatAddText}>Add</Text>
          </TouchableOpacity>
        </View>
      )}

      {canLog && metricType && !showNewCat && (
        <TouchableOpacity
          style={[styles.addBtn, showForm && styles.addBtnActive]}
          onPress={() => setShowForm((v) => !v)}
          activeOpacity={0.8}
        >
          <Text style={[styles.addBtnText, showForm && styles.addBtnTextActive]}>
            {showForm ? '✕' : `+ Log ${metricType}`}
          </Text>
        </TouchableOpacity>
      )}

      {showForm && metricType && (
        <Card style={styles.formCard}>
          {isStaff && !isOwnPatient && (
            <View style={styles.staffBanner}>
              <Text style={styles.staffBannerText}>Staff entry — logged on client's behalf</Text>
            </View>
          )}
          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.fieldLabel}>Value</Text>
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={setValue}
                placeholder="e.g. 82"
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
                placeholder="e.g. kg, cm, %"
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

      {trend.length >= 2 && metricType && (
        <MetricChart data={trend} label={metricType} />
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
        <Text style={styles.title}>Measurements</Text>
        <View style={{ width: 50 }} />
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={Header}
        ListEmptyComponent={
          showForm || showNewCat ? null : !metricType ? (
            <EmptyState
              icon="📊"
              title="No measurements yet"
              subtitle={canLog ? 'Tap "+ New" to start tracking something.' : 'Nothing tracked yet.'}
            />
          ) : (
            <EmptyState
              icon="📊"
              title="No entries yet"
              subtitle={canLog ? `Tap "+ Log ${metricType}" to add the first one.` : 'No entries logged yet.'}
            />
          )
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
  newChip: { borderStyle: 'dashed' },
  newChipText: { color: colors.primary },

  newCatRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, alignItems: 'center' },
  newCatInput: { flex: 1 },
  newCatAddBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  newCatAddText: { ...typography.label, color: colors.text.inverse, fontWeight: '600' as const },

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
