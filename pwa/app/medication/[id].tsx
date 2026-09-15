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
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { colors, spacing, typography, radius, shadows } from '../../theme';
import { getMedicationById, type FoodInstruction } from '../../api/medications';
import { useAuth } from '../../context/auth';
import { getMedicationCached, deleteMedicationOffline, type OfflineMedication as Medication } from '../../offline/entities/medications';
import { cache, onCacheChanged } from '../../offline/cache';
import { sameData } from '../../offline/util';

export default function MedicationDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const idIsTemp = id.startsWith('tmp_');
  const medId = idIsTemp ? id : Number(id);

  const [medication, setMedication] = useState<Medication | null>(() => cache.getSync<Medication>('medications', medId) ?? null);
  const [loading, setLoading] = useState(() => cache.getSync<Medication>('medications', medId) === undefined);
  const [error, setError] = useState<string | null>(null);

  const refreshFromCache = React.useCallback(async () => {
    const cached = await getMedicationCached(medId);
    if (cached) { setMedication((prev) => (sameData(prev, cached) ? prev : cached)); setLoading(false); }
    return cached;
  }, [medId]);

  const load = React.useCallback(async () => {
    const cached = await refreshFromCache();
    if (idIsTemp) { setLoading(false); return; }
    try {
      const fresh = await getMedicationById(medId as number);
      await cache.put('medications', fresh);
      setMedication((prev) => (sameData(prev, fresh) ? prev : fresh));
    } catch (e) {
      if (!cached) setError(e instanceof Error ? e.message : t('medicationDetail.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [medId, idIsTemp, t, refreshFromCache]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => onCacheChanged('medications', () => refreshFromCache()), [refreshFromCache]);

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
      t('medicationDetail.deletePeptideTitle'),
      t('medicationDetail.deleteBody', {
        name: medication.dosage ? `${medication.name} · ${medication.dosage}` : medication.name,
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteMedicationOffline(medication.id);
            router.back();
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
            <Text style={styles.backText}>{t('common.backWithArrow')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? t('medicationDetail.notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>{t('common.backWithArrow')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <Text style={styles.name}>{medication.name}</Text>
          {medication.dosage && <Text style={styles.dosage}>{medication.dosage}</Text>}
          <View style={styles.countBadge}>
            <Text style={styles.countText}>
              {t('medicationDetail.activePatient', { count: medication._count.assignments })}
            </Text>
          </View>
        </View>

        {medication.form && (
          <InfoRow label={t('medicationDetail.form')} value={t(`medications.formLabel.${medication.form}`)} />
        )}
        {medication.quantityPerDose !== null && (
          <InfoRow label={t('medicationDetail.quantityPerDose')} value={String(medication.quantityPerDose)} />
        )}
        {medication.foodInstruction && (
          <InfoRow label={t('medicationDetail.foodInstruction')} value={foodLabel(medication.foodInstruction, t)} />
        )}
        {medication.instructions && (
          <InfoRow label={t('medicationDetail.instructions')} value={medication.instructions} />
        )}
        {medication.prescribingNotes && (
          <InfoRow label={t('medicationDetail.prescribingNotes')} value={medication.prescribingNotes} />
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
          <Text style={styles.assignBtnText}>{t('medicationDetail.assignToPatient')}</Text>
        </TouchableOpacity>

        {user?.role === 'ADMIN' && (
          <View style={styles.deleteRow}>
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Feather name="trash-2" size={13} color={colors.danger} />
              <Text style={styles.deleteBtnText}>{t('common.delete')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const FOOD_KEY: Record<FoodInstruction, string> = {
  WITH_FOOD: 'medications.food.withFood',
  WITHOUT_FOOD: 'medications.food.withoutFood',
  EITHER: 'medications.food.either',
};

function foodLabel(value: FoodInstruction, t: TFunction): string {
  return t(FOOD_KEY[value]);
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
