import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing, typography, radius, shadows } from '../../theme';
import { createAssignment } from '../../api/assignments';
import { api } from '../../api/client';

interface PatientOption {
  id: number;
  userId: number;
  user: { id: number; firstName: string; lastName: string; email: string };
}

const FREQUENCIES = ['Once daily', 'Twice daily', 'Three times daily', 'As needed', 'Weekly'];

export default function AssignMedicationScreen() {
  const { medicationId, medicationName } = useLocalSearchParams<{
    medicationId: string;
    medicationName: string;
  }>();
  const router = useRouter();

  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const [frequency, setFrequency] = useState(FREQUENCIES[0]);
  const [timesOfDay, setTimesOfDay] = useState('08:00');
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split('T')[0], // YYYY-MM-DD
  );
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<PatientOption[]>('/patients')
      .then(setPatients)
      .catch(() => setPatients([]))
      .finally(() => setPatientsLoading(false));
  }, []);

  const canSubmit =
    selectedPatient !== null &&
    frequency.trim().length > 0 &&
    timesOfDay.trim().length > 0 &&
    startDate.trim().length > 0;

  const handleAssign = async () => {
    if (!canSubmit || !selectedPatient) return;
    setSaving(true);
    try {
      await createAssignment(selectedPatient.id, {
        medicationId: Number(medicationId),
        frequency,
        timesOfDay: timesOfDay.split(',').map((t) => t.trim()).filter(Boolean),
        startDate,
        endDate: endDate.trim() || null,
      });
      Alert.alert('Assignment created', `${medicationName} has been assigned.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Failed to assign', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
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
              <Text style={styles.backText}>← Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.navTitle}>Assign Medication</Text>
            <View style={styles.navSpacer} />
          </View>

          {/* Medication badge */}
          <View style={styles.medBadge}>
            <Text style={styles.medBadgeLabel}>Medication</Text>
            <Text style={styles.medBadgeName}>{medicationName}</Text>
          </View>

          {/* Patient picker */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Select Patient *</Text>
            {patientsLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : patients.length === 0 ? (
              <Text style={styles.noPatients}>No patients found</Text>
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
                    <Text style={styles.patientEmail}>{p.user.email}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Frequency */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Frequency *</Text>
            <View style={styles.chipRow}>
              {FREQUENCIES.map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.chip, frequency === f && styles.chipSelected]}
                  onPress={() => setFrequency(f)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, frequency === f && styles.chipTextSelected]}>
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Times of day */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Times of Day * (comma-separated)</Text>
            <TextInput
              style={styles.input}
              value={timesOfDay}
              onChangeText={setTimesOfDay}
              placeholder="e.g. 08:00, 20:00"
              placeholderTextColor={colors.text.muted}
            />
          </View>

          {/* Dates */}
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.sectionLabel}>Start Date *</Text>
              <TextInput
                style={styles.input}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.text.muted}
              />
            </View>
            <View style={styles.flex}>
              <Text style={styles.sectionLabel}>End Date</Text>
              <TextInput
                style={styles.input}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.text.muted}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, (!canSubmit || saving) && styles.saveBtnDisabled]}
            onPress={handleAssign}
            disabled={!canSubmit || saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <Text style={styles.saveBtnText}>Assign to Patient</Text>
            )}
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
