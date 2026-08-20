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
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { colors, radius, shadows, spacing, typography } from '../../theme';
import { EmptyState } from '../../components/EmptyState';
import { HealthLogCard } from '../../components/HealthLogCard';
import { WeightChart } from '../../components/WeightChart';
import {
  getHealthLogs,
  getWeightTrend,
  createHealthLog,
  type HealthLog,
  type WeightDataPoint,
} from '../../api/healthLog';
import { api } from '../../api/client';
import { FeelingPicker } from '../../components/FeelingPicker';
import { PhotoPicker } from '../../components/PhotoPicker';
import {
  Alert,
  TextInput,
} from 'react-native';
import type { FeelingStatus } from '../../api/healthLog';

const SCREEN_W = Dimensions.get('window').width;

interface PatientMeta {
  id: number;
  user: { firstName: string; lastName: string; email: string };
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export default function PatientHealthLogScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const router = useRouter();
  const pid = Number(patientId);

  const [patient,   setPatient]   = useState<PatientMeta | null>(null);
  const [logs,      setLogs]      = useState<HealthLog[]>([]);
  const [trend,     setTrend]     = useState<WeightDataPoint[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm,  setShowForm]  = useState(false);
  const [savedLogId, setSavedLogId] = useState<number | null>(null);

  // Form state
  const [date,    setDate]    = useState(todayISO);
  const [weight,  setWeight]  = useState('');
  const [height,  setHeight]  = useState('');
  const [feeling, setFeeling] = useState<FeelingStatus | null>(null);
  const [notes,   setNotes]   = useState('');
  const [saving,  setSaving]  = useState(false);

  const hasLoadedRef = useRef(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else if (!hasLoadedRef.current) setLoading(true);
    try {
      const [patientData, logData, trendData] = await Promise.all([
        api.get<PatientMeta>(`/patients/${pid}`),
        getHealthLogs(pid, { limit: 50 }),
        getWeightTrend(pid, 60),
      ]);
      setPatient(patientData);
      setLogs(logData);
      setTrend(trendData);
    } catch {
      // keep state
    } finally {
      setLoading(false);
      setRefreshing(false);
      hasLoadedRef.current = true;
    }
  }, [pid]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSave = async () => {
    if (!date.trim()) { Alert.alert('Date required'); return; }
    setSaving(true);
    try {
      const log = await createHealthLog(pid, {
        date:    date.trim(),
        weight:  weight  ? parseFloat(weight)  : null,
        height:  height  ? parseFloat(height)  : null,
        feeling: feeling,
        notes:   notes.trim() || null,
      });
      setLogs((prev) => [log, ...prev]);
      if (log.weight) {
        const point = { date: log.date.split('T')[0], weight: log.weight };
        setTrend((prev) => [...prev, point].sort((a, b) => a.date.localeCompare(b.date)));
      }
      setDate(todayISO());
      setWeight(''); setHeight(''); setFeeling(null); setNotes('');
      setSavedLogId(log.id); // move to photo step
    } catch (e) {
      Alert.alert('Could not save entry', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
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
    : 'Patient';

  const Header = (
    <View>
      {/* Staff entry form */}
      {/* Photo-attachment step (appears after form is saved) */}
      {savedLogId !== null && (
        <View style={styles.formCard}>
          <Text style={styles.photoStepTitle}>Entry saved! Attach a photo?</Text>
          <PhotoPicker
            patientId={pid}
            healthLogId={savedLogId}
            onUploaded={() => { setSavedLogId(null); setShowForm(false); }}
          />
          <TouchableOpacity style={styles.skipBtn} onPress={() => { setSavedLogId(null); setShowForm(false); }}>
            <Text style={styles.skipBtnText}>Skip →</Text>
          </TouchableOpacity>
        </View>
      )}

      {showForm && savedLogId === null && (
        <View style={styles.formCard}>
          <View style={styles.staffBanner}>
            <Text style={styles.staffBannerText}>Staff entry — logged on patient's behalf</Text>
          </View>

          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.fieldLabel}>Date *</Text>
              <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.text.muted} />
            </View>
            <View style={styles.half}>
              <Text style={styles.fieldLabel}>Weight (kg)</Text>
              <TextInput style={styles.input} value={weight} onChangeText={setWeight} placeholder="e.g. 70.5" placeholderTextColor={colors.text.muted} keyboardType="decimal-pad" />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Height (cm)</Text>
            <TextInput style={styles.input} value={height} onChangeText={setHeight} placeholder="e.g. 175" placeholderTextColor={colors.text.muted} keyboardType="decimal-pad" />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>How is the patient feeling?</Text>
            <FeelingPicker value={feeling} onChange={setFeeling} />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Observations, symptoms..."
              placeholderTextColor={colors.text.muted}
              multiline
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving
              ? <ActivityIndicator color={colors.text.inverse} />
              : <Text style={styles.saveBtnText}>Save Entry</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {trend.length >= 2 && (
        <WeightChart data={trend} width={SCREEN_W - spacing.lg * 2} />
      )}

      {logs.length > 0 && (
        <Text style={styles.sectionTitle}>History</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Nav bar */}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addBtn, showForm && styles.addBtnActive]}
            onPress={() => setShowForm((v) => !v)}
            activeOpacity={0.8}
          >
            <Text style={[styles.addBtnText, showForm && styles.addBtnTextActive]}>
              {showForm ? '✕' : '+ Add Entry'}
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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
          }
          renderItem={({ item }) => <HealthLogCard log={item} />}
          ListEmptyComponent={
            !showForm
              ? <EmptyState icon="📈" title="No health logs" subtitle="Tap 'Add Entry' to record the first entry for this patient." />
              : null
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg.app },
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
