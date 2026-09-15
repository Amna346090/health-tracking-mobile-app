import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { colors, spacing, typography, radius, shadows } from '../../theme';
import { api } from '../../api/client';
import { TimeField } from '../../components/TimeField';
import { DateField } from '../../components/DateField';
import { createAssignmentOffline } from '../../offline/entities/assignments';
import { listPatientsCached, mergePatientsFromServer } from '../../offline/entities/patients';

interface PatientOption {
  id: string | number;
  userId: string | number;
  user: { id: number; firstName: string; lastName: string; email: string | null; username: string | null };
}

const FREQUENCIES = ['Once daily', 'Twice daily', 'Three times daily', 'As needed', 'Weekly'];

const FREQUENCY_LABEL_KEY: Record<string, string> = {
  'Once daily': 'medicationForm.frequencyOptions.onceDaily',
  'Twice daily': 'medicationForm.frequencyOptions.twiceDaily',
  'Three times daily': 'medicationForm.frequencyOptions.threeTimesDaily',
  'As needed': 'medicationForm.frequencyOptions.asNeeded',
  'Weekly': 'medicationForm.frequencyOptions.weekly',
};

function frequencyLabel(f: string, t: TFunction): string {
  return FREQUENCY_LABEL_KEY[f] ? t(FREQUENCY_LABEL_KEY[f]) : f;
}

// Default number of time slots shown when a frequency is picked — the doctor can still
// add/remove slots afterward; the sent count always just equals however many are left.
const FREQUENCY_DEFAULT_COUNT: Record<string, number> = {
  'Once daily': 1,
  'Twice daily': 2,
  'Three times daily': 3,
  'As needed': 0,
  'Weekly': 1,
};

function timesForCount(current: string[], count: number): string[] {
  if (count <= current.length) return current.slice(0, count);
  return [...current, ...Array(count - current.length).fill('08:00')];
}

export default function AssignMedicationScreen() {
  const { t } = useTranslation();
  const { medicationId, medicationName } = useLocalSearchParams<{
    medicationId: string;
    medicationName: string;
  }>();
  const router = useRouter();

  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const [frequency, setFrequency] = useState(FREQUENCIES[0]);
  const [times, setTimes] = useState<string[]>(timesForCount([], FREQUENCY_DEFAULT_COUNT[FREQUENCIES[0]]));
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split('T')[0], // YYYY-MM-DD
  );
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    (async () => {
      const cached = await listPatientsCached();
      if (cached.length > 0) { setPatients(cached); setPatientsLoading(false); }
      try {
        const data = await api.get<PatientOption[]>('/patients');
        const merged = await mergePatientsFromServer(data as never);
        setPatients(merged as unknown as PatientOption[]);
      } catch {
        // offline — keep showing the cached list
      } finally {
        setPatientsLoading(false);
      }
    })();
  }, []);

  function handleFrequencyChange(f: string) {
    setFrequency(f);
    setTimes((prev) => timesForCount(prev, FREQUENCY_DEFAULT_COUNT[f] ?? prev.length));
  }

  function addTime() {
    setTimes((prev) => [...prev, '08:00']);
  }

  function removeTime(index: number) {
    setTimes((prev) => prev.filter((_, i) => i !== index));
  }

  function updateTime(index: number, value: string) {
    setTimes((prev) => prev.map((t, i) => (i === index ? value : t)));
  }

  const canSubmit =
    selectedPatient !== null &&
    frequency.trim().length > 0 &&
    startDate.trim().length > 0;

  // Written to local storage and reflected immediately; syncs to the server right away if
  // online, or as soon as the connection comes back if not.
  const handleAssign = async () => {
    if (!canSubmit || !selectedPatient) return;
    const validTimes = times.filter(Boolean);
    await createAssignmentOffline(selectedPatient.id, {
      medicationId: isNaN(Number(medicationId)) ? medicationId : Number(medicationId),
      frequency,
      timesPerDay: validTimes.length || undefined,
      timesOfDay: validTimes,
      startDate,
      endDate: endDate.trim() || null,
    });
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.navBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backText}>{t('medicationForm.cancelWithArrow')}</Text>
            </TouchableOpacity>
            <Text style={styles.navTitle}>{t('medicationForm.assignTitle')}</Text>
            <View style={styles.navSpacer} />
          </View>

          {/* Peptide badge */}
          <View style={styles.medBadge}>
            <Text style={styles.medBadgeLabel}>{t('medicationForm.peptideLabel')}</Text>
            <Text style={styles.medBadgeName}>{medicationName}</Text>
          </View>

          {/* Patient picker */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('medicationForm.selectPatientLabel')}</Text>
            {patientsLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : patients.length === 0 ? (
              <Text style={styles.noPatients}>{t('medicationForm.noPatientsFound')}</Text>
            ) : (
              patients.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.patientRow,
                    selectedPatient?.id === p.id && styles.patientRowSelected,
                  ]}
                  onPress={() => setSelectedPatient(p)}
                  activeOpacity={0.7}
                >
                  <View style={styles.patientAvatar}>
                    <Text style={styles.patientAvatarText}>
                      {p.user.firstName[0]?.toUpperCase() ?? '?'}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.patientName}>
                      {p.user.firstName} {p.user.lastName}
                    </Text>
                    <Text style={styles.patientEmail}>{p.user.email ?? p.user.username}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Frequency */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('medicationForm.frequencyLabel')}</Text>
            <View style={styles.chipRow}>
              {FREQUENCIES.map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.chip, frequency === f && styles.chipSelected]}
                  onPress={() => handleFrequencyChange(f)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, frequency === f && styles.chipTextSelected]}>
                    {frequencyLabel(f, t)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Times of day */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {t('medicationForm.timesPerDay', { count: times.length })}
            </Text>
            <View style={{ gap: spacing.sm }}>
              {times.map((time, i) => (
                <View key={i} style={styles.timeRow}>
                  <View style={styles.flex}>
                    <TimeField label={t('medicationForm.timeSlotLabel', { n: i + 1 })} value={time} onChange={(v) => updateTime(i, v)} />
                  </View>
                  <TouchableOpacity
                    onPress={() => removeTime(i)}
                    style={styles.removeTimeBtn}
                    accessibilityLabel={t('medicationForm.removeTimeA11y')}
                  >
                    <Feather name="x" size={16} color={colors.text.secondary} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={addTime} style={styles.addTimeBtn} activeOpacity={0.7}>
                <Feather name="plus" size={14} color={colors.primary} />
                <Text style={styles.addTimeText}>{t('medicationForm.addTime')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Dates */}
          <View style={styles.row}>
            <View style={styles.flex}>
              <DateField label={t('medicationForm.startDateLabel')} value={startDate} onChange={setStartDate} />
            </View>
            <View style={styles.flex}>
              <DateField label={t('medicationForm.endDateLabel')} value={endDate} onChange={setEndDate} minimumDate={startDate ? new Date(`${startDate}T00:00:00`) : undefined} />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, !canSubmit && styles.saveBtnDisabled]}
            onPress={handleAssign}
            disabled={!canSubmit}
            activeOpacity={0.8}
          >
            <Text style={styles.saveBtnText}>{t('medicationDetail.assignToPatient')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.app },
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  backBtn: {},
  backText: { ...typography.body1, color: colors.primary },
  navTitle: { ...typography.h4, color: colors.text.primary },
  navSpacer: { width: 60 },

  medBadge: {
    backgroundColor: colors.primaryBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  medBadgeLabel: { ...typography.caption, color: colors.primary, fontWeight: '600' as const },
  medBadgeName: { ...typography.h3, color: colors.primary },

  timeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  removeTimeBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bg.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  addTimeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bg.card,
  },
  addTimeText: { ...typography.body2, color: colors.primary, fontWeight: '600' as const },

  section: { marginBottom: spacing.lg, gap: spacing.sm },
  sectionLabel: { ...typography.label, color: colors.text.secondary },

  input: {
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body2,
    color: colors.text.primary,
    ...shadows.sm,
  },

  row: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },

  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  patientRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg,
  },
  patientAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientAvatarText: { ...typography.body1, color: colors.primary, fontWeight: '600' as const },
  patientName: { ...typography.label, color: colors.text.primary },
  patientEmail: { ...typography.caption, color: colors.text.muted },
  noPatients: { ...typography.body2, color: colors.text.muted },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg.card,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  chipText: { ...typography.body2, color: colors.text.secondary },
  chipTextSelected: { color: colors.primary, fontWeight: '600' as const },

  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...shadows.md,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { ...typography.body1, fontWeight: '600' as const, color: colors.text.inverse },
});
