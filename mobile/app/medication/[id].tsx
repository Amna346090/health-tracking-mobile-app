import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing, typography, radius, shadows } from '../../theme';
import { getMedicationById, type Medication } from '../../api/medications';

export default function MedicationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const medId = Number(id);

  const [medication, setMedication] = useState<Medication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
});
