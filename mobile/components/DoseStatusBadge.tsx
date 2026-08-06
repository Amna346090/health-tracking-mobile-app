import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, radius } from '../theme';
import type { DoseStatus } from '../api/assignments';

type BadgeVariant = DoseStatus | 'DUE' | 'UPCOMING' | 'NONE';

const CONFIG: Record<
  BadgeVariant,
  { label: string; bg: string; text: string }
> = {
  TAKEN:    { label: 'Taken',    bg: colors.successBg, text: colors.success },
  MISSED:   { label: 'Missed',   bg: colors.dangerBg,  text: colors.danger },
  SKIPPED:  { label: 'Skipped',  bg: colors.bg.subtle,  text: colors.text.secondary },
  DUE:      { label: 'Due',      bg: colors.warningBg,  text: colors.warning },
  UPCOMING: { label: 'Upcoming', bg: colors.primaryBg,  text: colors.primary },
  NONE:     { label: 'No log',   bg: colors.bg.subtle,  text: colors.text.muted },
};

interface Props {
  status: BadgeVariant;
}

export function DoseStatusBadge({ status }: Props) {
  const cfg = CONFIG[status] ?? CONFIG.NONE;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.label, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  label: {
    ...(typography.caption as object),
    fontWeight: '600' as const,
  },
});
