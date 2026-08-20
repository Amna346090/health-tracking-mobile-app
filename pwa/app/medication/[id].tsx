import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing, typography, radius, shadows } from '../../theme';
import { getMedicationById, deleteMedication, type Medication } from '../../api/medications';
import { useAuth } from '../../context/auth';

export default function MedicationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const medId = Number(id);

  const [medication, setMedication] = useState<Medication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getMedicationById(medId)
      .then(setMedication)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [medId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  function handleDelete() {
    if (!medication) return;
    Alert.alert(
      'Delete peptide?',
      `Delete ${medication.dosage ? `${medication.name} · ${medication.dosage}` : medication.name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteMedication(medication.id);
              router.back();
            } catch (e) {
              Alert.alert('Could not delete', e instanceof Error ? e.message : 'Please try again.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  if (error || !medication) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? 'Peptide not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <Text style={styles.name}>{medication.name}</Text>
          {medication.dosage && <Text style={styles.dosage}>{medication.dosage}</Text>}
          <View style={styles.countBadge}>
            <Text style={styles.countText}>
              {medication._count.assignments} active patient{medication._count.assignments !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {medication.form && (
          <InfoRow label="Form" value={formatEnum(medication.form)} />
        )}
        {medication.quantityPerDose !== null && (
          <InfoRow label="Quantity per dose" value={String(medication.quantityPerDose)} />
        )}
        {medication.foodInstruction && (
          <InfoRow label="Food instruction" value={formatEnum(medication.foodInstruction)} />
        )}
        {medication.instructions && (
          <InfoRow label="Instructions" value={medication.instructions} />
        )}
        {medication.prescribingNotes && (
          <InfoRow label="Prescribing notes" value={medication.prescribingNotes} />
        )}

        <TouchableOpacity
          style={styles.assignBtn}
          onPress={() =>
            router.push(
              `/medication/assign?medicationId=${medication.id}&medicationName=${encodeURIComponent(medication.name)}`,
            )
          }
          activeOpacity={0.8}
        >
          <Text style={styles.assignBtnText}>Assign to Patient</Text>
        </TouchableOpacity>

        {user?.role === 'ADMIN' && (
          <View style={styles.deleteRow}>
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={deleting}>
              <Feather name="trash-2" size={13} color={colors.danger} />
              <Text style={styles.deleteBtnText}>{deleting ? 'Deleting…' : 'Delete'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatEnum(value: string): string {
  return value
    .split('_')
    .map((w, i) => (i === 0 ? w.charAt(0) + w.slice(1).toLowerCase() : w.toLowerCase()))
    .join(' ');
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoText}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.app },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  navBar: { paddingTop: spacing.sm, paddingBottom: spacing.md },
  backBtn: { alignSelf: 'flex-start' },
  backText: { ...typography.body1, color: colors.primary },

  header: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.xs,
    ...shadows.sm,
  },
  name: { ...typography.h2, color: colors.text.primary },
  dosage: { ...typography.body1, color: colors.text.secondary },
  countBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryBg,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: spacing.xs,
  },
  countText: { ...typography.caption, color: colors.primary, fontWeight: '600' as const },

  infoCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
    ...shadows.sm,
  },
  infoLabel: { ...typography.label, color: colors.text.muted },
  infoText: { ...typography.body2, color: colors.text.primary },

  assignBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...shadows.md,
  },
  assignBtnText: { ...typography.body1, fontWeight: '600' as const, color: colors.text.inverse },

  errorText: { ...typography.body1, color: colors.danger },

  deleteRow: { marginTop: spacing.lg },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  deleteBtnText: { ...typography.label, color: colors.danger, fontWeight: '600' as const },
});
