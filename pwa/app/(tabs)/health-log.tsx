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
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/auth';
import { colors, radius, shadows, spacing, typography } from '../../theme';
import { EmptyState } from '../../components/EmptyState';
import { FeelingPicker } from '../../components/FeelingPicker';
import { HealthLogCard } from '../../components/HealthLogCard';
import { WeightChart } from '../../components/WeightChart';
import {
  createHealthLog,
  getHealthLogs,
  getWeightTrend,
  type FeelingStatus,
  type HealthLog,
  type WeightDataPoint,
} from '../../api/healthLog';
import { PhotoPicker } from '../../components/PhotoPicker';
import { api } from '../../api/client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

const SCREEN_W = Dimensions.get('window').width;

// ─── Inline log entry form ─────────────────────────────────────────────────────

interface FormState {
  date: string;
  weight: string;
  height: string;
  feeling: FeelingStatus | null;
  notes: string;
}

function emptyForm(): FormState {
  return { date: todayISO(), weight: '', height: '', feeling: null, notes: '' };
}

interface NewEntryFormProps {
  patientId: number;
  onCreated: (log: HealthLog) => void;
  staffMode?: boolean;
}

function NewEntryForm({ patientId, onCreated, staffMode }: NewEntryFormProps) {
  const { t } = useTranslation();
  const [form, setForm]           = useState<FormState>(emptyForm);
  const [saving, setSaving]       = useState(false);
  const [savedLog, setSavedLog]   = useState<HealthLog | null>(null);

  const set = (k: keyof FormState) => (v: string | FeelingStatus | null) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.date.trim()) {
      Alert.alert(t('healthLog.dateRequired'), t('healthLog.enterDate'));
      return;
    }
    setSaving(true);
    try {
      const log = await createHealthLog(patientId, {
        date:    form.date.trim(),
        weight:  form.weight  ? parseFloat(form.weight)  : null,
        height:  form.height  ? parseFloat(form.height)  : null,
        feeling: form.feeling,
        notes:   form.notes.trim() || null,
      });
      setForm(emptyForm());
      // Move to the optional photo-attachment step
      setSavedLog(log);
    } catch (e) {
      Alert.alert(t('healthLog.saveFailed'), e instanceof Error ? e.message : t('common.pleaseTryAgain'));
    } finally {
      setSaving(false);
    }
  };

  // ── Step 2: optional photo attachment ──────────────────────────────────────
  if (savedLog) {
    return (
      <View style={formStyles.card}>
        <Text style={formStyles.photoStepTitle}>{t('healthLog.entrySavedTitle')}</Text>
        <PhotoPicker
          patientId={patientId}
          healthLogId={savedLog.id}
          onUploaded={() => onCreated(savedLog)}
        />
        <TouchableOpacity
          style={formStyles.skipBtn}
          onPress={() => onCreated(savedLog)}
        >
          <Text style={formStyles.skipBtnText}>{t('healthLog.skip')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={formStyles.card}>
      {staffMode && (
        <View style={formStyles.staffBanner}>
          <Text style={formStyles.staffBannerText}>{t('healthLog.staffBanner')}</Text>
        </View>
      )}

      {/* Date */}
      <View style={formStyles.field}>
        <Text style={formStyles.label}>{t('healthLog.date')}</Text>
        <TextInput
          style={formStyles.input}
          value={form.date}
          onChangeText={set('date')}
          placeholder={t('healthLog.datePlaceholder')}
          placeholderTextColor={colors.text.muted}
        />
      </View>

      {/* Weight + Height side by side */}
      <View style={formStyles.row}>
        <View style={formStyles.halfField}>
          <Text style={formStyles.label}>{t('healthLog.weightKg')}</Text>
          <TextInput
            style={formStyles.input}
            value={form.weight}
            onChangeText={set('weight')}
            placeholder={t('healthLog.weightPlaceholder')}
            placeholderTextColor={colors.text.muted}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={formStyles.halfField}>
          <Text style={formStyles.label}>{t('healthLog.heightCm')}</Text>
          <TextInput
            style={formStyles.input}
            value={form.height}
            onChangeText={set('height')}
            placeholder={t('healthLog.heightPlaceholder')}
            placeholderTextColor={colors.text.muted}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      {/* Feeling */}
      <View style={formStyles.field}>
        <Text style={formStyles.label}>{t('healthLog.howFeeling')}</Text>
        <FeelingPicker
          value={form.feeling}
          onChange={(v) => set('feeling')(v)}
        />
      </View>

      {/* Notes */}
      <View style={formStyles.field}>
        <Text style={formStyles.label}>{t('healthLog.notes')}</Text>
        <TextInput
          style={[formStyles.input, formStyles.textArea]}
          value={form.notes}
          onChangeText={set('notes')}
          placeholder={t('healthLog.notesPlaceholder')}
          placeholderTextColor={colors.text.muted}
          multiline
          textAlignVertical="top"
        />
      </View>

      <TouchableOpacity
        style={[formStyles.saveBtn, saving && formStyles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator color={colors.text.inverse} />
        ) : (
          <Text style={formStyles.saveBtnText}>{t('healthLog.saveEntry')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const formStyles = StyleSheet.create({
  card: {
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
  field: { gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.md },
  halfField: { flex: 1, gap: spacing.xs },
  label: { ...(typography.label as object), color: colors.text.secondary },
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
  photoStepTitle: {
    ...(typography.h4 as object),
    color: colors.text.primary,
  },
  skipBtn: { alignItems: 'center', paddingVertical: spacing.xs },
  skipBtnText: { ...(typography.label as object), color: colors.text.muted },
});

// ─── Patient view ─────────────────────────────────────────────────────────────

function PatientHealthLog({ patientId }: { patientId: number }) {
  const { t } = useTranslation();
  const [logs, setLogs]               = useState<HealthLog[]>([]);
  const [trend, setTrend]             = useState<WeightDataPoint[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [showForm, setShowForm]       = useState(false);

  const hasLoadedRef = useRef(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else if (!hasLoadedRef.current) setLoading(true);
    try {
      const [logData, trendData] = await Promise.all([
        getHealthLogs(patientId, { limit: 50 }),
        getWeightTrend(patientId, 60),
      ]);
      setLogs(logData);
      setTrend(trendData);
      if (logData.length === 0) setShowForm(true);
    } catch {
      // keep previous state
    } finally {
      setLoading(false);
      setRefreshing(false);
      hasLoadedRef.current = true;
    }
  }, [patientId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleCreated = useCallback((log: HealthLog) => {
    setLogs((prev) => [log, ...prev]);
    setTrend((prev) => {
      if (!log.weight) return prev;
      const point = { date: log.date.split('T')[0], weight: log.weight };
      return [...prev, point].sort((a, b) => a.date.localeCompare(b.date));
    });
    setShowForm(false);
  }, []);

  const Header = (
    <View>
      {showForm && (
        <NewEntryForm patientId={patientId} onCreated={handleCreated} />
      )}
      {trend.length >= 2 && (
        <WeightChart data={trend} width={SCREEN_W - spacing.lg * 2} />
      )}
      {logs.length > 0 && (
        <Text style={listStyles.sectionTitle}>{t('healthLog.history')}</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={listStyles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={logs}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={listStyles.list}
      ListHeaderComponent={Header}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
      }
      renderItem={({ item }) => <HealthLogCard log={item} />}
      ListEmptyComponent={
        !showForm ? (
          <EmptyState
            icon="📈"
            title={t('healthLog.noLogsYetTitle')}
            subtitle={t('healthLog.noLogsYetSubtitle')}
          />
        ) : null
      }
    />
  );
}

// ─── Staff view (patient list) ────────────────────────────────────────────────

interface PatientRow {
  id: number;
  userId: number;
  user: { id: number; firstName: string; lastName: string; email: string | null; username: string | null };
}

function StaffHealthLog() {
  const { t } = useTranslation();
  const router = useRouter();
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    api.get<PatientRow[]>('/patients')
      .then(setPatients)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={listStyles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={patients}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={listStyles.list}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={listStyles.patientRow}
          onPress={() => router.push(`/health-log/${item.id}`)}
          activeOpacity={0.7}
        >
          <View style={listStyles.avatar}>
            <Text style={listStyles.avatarText}>
              {item.user.firstName[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <View style={listStyles.patientInfo}>
            <Text style={listStyles.patientName}>
              {item.user.firstName} {item.user.lastName}
            </Text>
            <Text style={listStyles.patientEmail}>{item.user.email ?? item.user.username}</Text>
          </View>
          <Text style={listStyles.chevron}>›</Text>
        </TouchableOpacity>
      )}
      ListEmptyComponent={
        <EmptyState icon="👥" title={t('healthLog.noPatientsFoundTitle')} subtitle={t('healthLog.noPatientsFoundSubtitle')} />
      }
    />
  );
}

// ─── Tab screen ───────────────────────────────────────────────────────────────

export default function HealthLogScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isStaff  = user?.role === 'STAFF' || user?.role === 'ADMIN';
  const patientId = user?.patientProfile?.id ?? null;
  const [showForm, setShowForm] = useState(false);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{t('nav.healthLog')}</Text>
            <Text style={styles.subtitle}>
              {isStaff ? t('healthLog.staffSubtitle') : t('healthLog.patientSubtitle')}
            </Text>
          </View>
          {!isStaff && patientId && (
            <TouchableOpacity
              style={[styles.newBtn, showForm && styles.newBtnActive]}
              onPress={() => setShowForm((v) => !v)}
              activeOpacity={0.8}
            >
              <Text style={[styles.newBtnText, showForm && styles.newBtnTextActive]}>
                {showForm ? t('healthLog.cancelNewEntry') : t('healthLog.newEntry')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {isStaff ? (
          <StaffHealthLog />
        ) : patientId ? (
          // Pass the showForm toggle down via a wrapper that re-renders PatientHealthLog header
          <PatientHealthLogWithForm patientId={patientId} externalShowForm={showForm} onFormToggle={setShowForm} />
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Wrapper that lets the header's "New Entry" button control form visibility
function PatientHealthLogWithForm({
  patientId,
  externalShowForm,
  onFormToggle,
}: {
  patientId: number;
  externalShowForm: boolean;
  onFormToggle: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const [logs, setLogs]             = useState<HealthLog[]>([]);
  const [trend, setTrend]           = useState<WeightDataPoint[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const hasLoadedRef = useRef(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else if (!hasLoadedRef.current) setLoading(true);
    try {
      const [logData, trendData] = await Promise.all([
        getHealthLogs(patientId, { limit: 50 }),
        getWeightTrend(patientId, 60),
      ]);
      setLogs(logData);
      setTrend(trendData);
      if (logData.length === 0) onFormToggle(true);
    } catch {
      // keep previous state
    } finally {
      setLoading(false);
      setRefreshing(false);
      hasLoadedRef.current = true;
    }
  }, [patientId, onFormToggle]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleCreated = useCallback((log: HealthLog) => {
    setLogs((prev) => [log, ...prev]);
    if (log.weight) {
      const point = { date: log.date.split('T')[0], weight: log.weight };
      setTrend((prev) => [...prev, point].sort((a, b) => a.date.localeCompare(b.date)));
    }
    onFormToggle(false);
  }, [onFormToggle]);

  if (loading) {
    return (
      <View style={listStyles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const Header = (
    <View>
      {externalShowForm && (
        <NewEntryForm patientId={patientId} onCreated={handleCreated} />
      )}
      {trend.length >= 2 && (
        <WeightChart data={trend} width={SCREEN_W - spacing.lg * 2} />
      )}
      {logs.length > 0 && (
        <Text style={listStyles.sectionTitle}>{t('healthLog.history')}</Text>
      )}
    </View>
  );

  return (
    <FlatList
      data={logs}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={listStyles.list}
      ListHeaderComponent={Header}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
      }
      renderItem={({ item }) => <HealthLogCard log={item} />}
      ListEmptyComponent={
        !externalShowForm ? (
          <EmptyState
            icon="📈"
            title={t('healthLog.noLogsYetTitle')}
            subtitle={t('healthLog.noLogsYetSubtitleAbove')}
          />
        ) : null
      }
    />
  );
}

const listStyles = StyleSheet.create({
  list:         { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { ...(typography.h4 as object), color: colors.text.primary, marginBottom: spacing.sm },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
    ...shadows.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...(typography.h4 as object), color: colors.primary },
  patientInfo: { flex: 1 },
  patientName: { ...(typography.body1 as object), fontWeight: '600' as const, color: colors.text.primary },
  patientEmail: { ...(typography.caption as object), color: colors.text.muted },
  chevron: { ...(typography.h3 as object), color: colors.text.muted },
});

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bg.app },
  flex:    { flex: 1 },
  header:  {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  title:   { ...(typography.h1 as object), color: colors.text.primary },
  subtitle: { ...(typography.body2 as object), color: colors.text.secondary, maxWidth: 220 },
  newBtn: {
    backgroundColor: colors.primaryBg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    marginTop: 4,
  },
  newBtnActive: { backgroundColor: colors.bg.subtle, borderColor: colors.border },
  newBtnText: {
    ...(typography.label as object),
    color: colors.primary,
    fontWeight: '600' as const,
  },
  newBtnTextActive: { color: colors.text.secondary },
});
