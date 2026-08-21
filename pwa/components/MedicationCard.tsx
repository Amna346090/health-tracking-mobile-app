import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { colors, spacing, typography, radius, shadows } from '../theme';
import { DoseStatusBadge } from './DoseStatusBadge';
import type { TodayScheduleItem, MedicationAssignment, DoseStatus } from '../api/assignments';

// ─── Helpers ────────────────────────────────────────────────────────────────

const FORM_KEY: Record<string, string> = {
  TABLET: 'medications.form.tablet',
  CAPSULE: 'medications.form.capsule',
  LIQUID: 'medications.form.dose',
  INJECTION: 'medications.form.injection',
  TOPICAL: 'medications.form.application',
  OTHER: 'medications.form.unit',
};

const FOOD_KEY: Record<string, string> = {
  WITH_FOOD: 'medications.food.withFood',
  WITHOUT_FOOD: 'medications.food.withoutFood',
  EITHER: 'medications.food.either',
};

// Times are stored as literal UTC "HH:MM" strings (the backend matches them against its own
// UTC clock) — comparing against the device's current UTC time keeps this consistent with
// when the reminder actually fires, even though neither one accounts for the patient's timezone yet.
function currentUtcHHMM(): string {
  const now = new Date();
  return `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
}

function computeTodayStatus(item: TodayScheduleItem): DoseStatus | 'DUE' | 'UPCOMING' {
  if (item.todayLog) return item.todayLog.status;
  if (item.timesOfDay.length === 0) return 'DUE';
  const earliestTime = [...item.timesOfDay].sort()[0];
  return currentUtcHHMM() >= earliestTime ? 'DUE' : 'UPCOMING';
}

function formatDoseDetail(
  quantityPerDose: number | null,
  form: string | null,
  foodInstruction: string | null,
  t: TFunction,
): string | null {
  const parts: string[] = [];
  if (quantityPerDose) {
    const unitKey = form ? FORM_KEY[form] ?? FORM_KEY.OTHER : FORM_KEY.OTHER;
    parts.push(t(unitKey, { count: quantityPerDose }));
  }
  if (foodInstruction) parts.push(FOOD_KEY[foodInstruction] ? t(FOOD_KEY[foodInstruction]) : foodInstruction);
  return parts.length > 0 ? parts.join(' · ') : null;
}

// ─── Patient card (shows today's dose status) ─────────────────────────────────

interface ScheduleCardProps {
  item: TodayScheduleItem;
  onMarkTaken: (assignmentId: number) => void;
  disabled?: boolean;
}

export function TodayMedicationCard({ item, onMarkTaken, disabled }: ScheduleCardProps) {
  const { t } = useTranslation();
  const alreadyLogged = item.todayLog !== null;
  const status = computeTodayStatus(item);
  const doseDetail = formatDoseDetail(
    item.medication.quantityPerDose,
    item.medication.form,
    item.medication.foodInstruction,
    t,
  );

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.info}>
          <Text style={styles.name}>{item.medication.name}</Text>
          {item.medication.dosage && <Text style={styles.dosage}>{item.medication.dosage}</Text>}
          {item.timesOfDay.length > 0 && (
            <Text style={styles.times}>{item.timesOfDay.join(' · ')}</Text>
          )}
          {doseDetail && <Text style={styles.times}>{doseDetail}</Text>}
        </View>
        <DoseStatusBadge status={status} />
      </View>

      {!alreadyLogged && (
        <TouchableOpacity
          style={[styles.markBtn, disabled && styles.markBtnDisabled]}
          onPress={() => onMarkTaken(item.id)}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text style={styles.markBtnText}>{t('medications.markAsTaken')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Assignment list card (patient medications tab) ───────────────────────────

interface AssignmentCardProps {
  item: MedicationAssignment;
  onPress: (item: MedicationAssignment) => void;
}

export function AssignmentCard({ item, onPress }: AssignmentCardProps) {
  const { t } = useTranslation();
  const doseDetail = formatDoseDetail(
    item.medication.quantityPerDose,
    item.medication.form,
    item.medication.foodInstruction,
    t,
  );
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(item)} activeOpacity={0.7}>
      <Text style={styles.name}>{item.medication.name}</Text>
      {item.medication.dosage && <Text style={styles.dosage}>{item.medication.dosage}</Text>}
      <Text style={styles.times}>
        {item.frequency
          ? [item.frequency, item.timesOfDay.join(', ')].filter(Boolean).join(' · ')
          : t('medications.scheduleNotSet')}
      </Text>
      {doseDetail && <Text style={styles.times}>{doseDetail}</Text>}
      {item.medication.instructions && (
        <Text style={styles.instructions} numberOfLines={2}>
          {item.medication.instructions}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Catalog card (staff medications tab) ─────────────────────────────────────

interface CatalogCardProps {
  item: {
    id: number;
    name: string;
    dosage: string | null;
    form: string | null;
    quantityPerDose: number | null;
    foodInstruction: string | null;
    instructions: string | null;
    _count: { assignments: number };
  };
  onPress: (id: number) => void;
}

export function CatalogMedicationCard({ item, onPress }: CatalogCardProps) {
  const { t } = useTranslation();
  const doseDetail = formatDoseDetail(item.quantityPerDose, item.form, item.foodInstruction, t);
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(item.id)} activeOpacity={0.7}>
      <View style={styles.row}>
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
          {item.dosage && <Text style={styles.dosage}>{item.dosage}</Text>}
          {doseDetail && <Text style={styles.times}>{doseDetail}</Text>}
          {item.instructions && (
            <Text style={styles.instructions} numberOfLines={2}>{item.instructions}</Text>
          )}
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{item._count.assignments}</Text>
          <Text style={styles.countLabel}>{t('medications.active')}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  info: {
    flex: 1,
  },
  name: {
    ...(typography.body1 as object),
    fontWeight: '600' as const,
    color: colors.text.primary,
    marginBottom: 2,
  },
  dosage: {
    ...(typography.body2 as object),
    color: colors.text.secondary,
  },
  times: {
    ...(typography.caption as object),
    color: colors.text.muted,
    marginTop: 2,
  },
  instructions: {
    ...(typography.caption as object),
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  markBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    alignItems: 'center' as const,
  },
  markBtnDisabled: {
    opacity: 0.5,
  },
  markBtnText: {
    ...(typography.body2 as object),
    fontWeight: '600' as const,
    color: colors.text.inverse,
  },
  countBadge: {
    alignItems: 'center' as const,
    backgroundColor: colors.primaryBg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 44,
  },
  countText: {
    ...(typography.body1 as object),
    fontWeight: '700' as const,
    color: colors.primary,
  },
  countLabel: {
    ...(typography.caption as object),
    color: colors.primary,
  },
});
