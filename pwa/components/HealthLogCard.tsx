import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, typography, radius, shadows } from '../theme';
import { FEELING_EMOJI } from './FeelingPicker';
import type { HealthLog } from '../api/healthLog';

function formatDate(iso: string): { day: string; month: string; year: string } {
  const d = new Date(iso);
  return {
    day:   d.getDate().toString().padStart(2, '0'),
    month: d.toLocaleDateString('en-US', { month: 'short' }),
    year:  d.getFullYear().toString(),
  };
}

interface Props {
  log: HealthLog;
  onPress?: (log: HealthLog) => void;
}

export function HealthLogCard({ log, onPress }: Props) {
  const { day, month } = formatDate(log.date);
  const isStaffEntry = log.createdBy.role !== 'PATIENT';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(log)}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={styles.row}>
        {/* Date badge */}
        <View style={styles.dateBadge}>
          <Text style={styles.dateDay}>{day}</Text>
          <Text style={styles.dateMonth}>{month}</Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.metrics}>
            {log.weight !== null && (
              <View style={styles.pill}>
                <Text style={styles.pillText}>{log.weight} kg</Text>
              </View>
            )}
            {log.height !== null && (
              <View style={[styles.pill, styles.pillAlt]}>
                <Text style={[styles.pillText, styles.pillTextAlt]}>{log.height} cm</Text>
              </View>
            )}
            {log.feeling && (
              <Text style={styles.feeling}>{FEELING_EMOJI[log.feeling]}</Text>
            )}
          </View>

          {log.notes ? (
            <Text style={styles.notes} numberOfLines={1}>{log.notes}</Text>
          ) : null}

          {isStaffEntry && (
            <View style={styles.staffRow}>
              <View style={styles.staffBadge}>
                <Text style={styles.staffBadgeText}>Staff entry</Text>
              </View>
              <Text style={styles.staffName}>
                {log.createdBy.firstName} {log.createdBy.lastName}
              </Text>
            </View>
          )}
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
    gap: spacing.md,
  },
  dateBadge: {
    alignItems: 'center',
    backgroundColor: colors.primaryBg,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    minWidth: 40,
  },
  dateDay: {
    ...(typography.h4 as object),
    color: colors.primary,
  },
  dateMonth: {
    ...(typography.caption as object),
    color: colors.primary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  content: { flex: 1, gap: spacing.xs },
  metrics: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: spacing.xs,
  },
  pill: {
    backgroundColor: colors.primaryBg,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  pillAlt: {
    backgroundColor: colors.bg.subtle,
  },
  pillText: {
    ...(typography.caption as object),
    fontWeight: '600' as const,
    color: colors.primary,
  },
  pillTextAlt: {
    color: colors.text.secondary,
  },
  feeling: { fontSize: 18 },
  notes: {
    ...(typography.body2 as object),
    color: colors.text.secondary,
  },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  staffBadge: {
    backgroundColor: colors.warningBg,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
  },
  staffBadgeText: {
    ...(typography.caption as object),
    color: colors.warning,
    fontWeight: '600' as const,
  },
  staffName: {
    ...(typography.caption as object),
    color: colors.text.muted,
  },
});
