import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, typography, radius } from '../theme';
import type { DoseStatus } from '../api/assignments';

type BadgeVariant = DoseStatus | 'DUE' | 'UPCOMING' | 'NONE';

const CONFIG: Record<
  BadgeVariant,
  { labelKey: string; bg: string; text: string }
> = {
  TAKEN:    { labelKey: 'medications.status.taken',    bg: colors.successBg, text: colors.success },
  MISSED:   { labelKey: 'medications.status.missed',   bg: colors.dangerBg,  text: colors.danger },
  SKIPPED:  { labelKey: 'medications.status.skipped',  bg: colors.bg.subtle,  text: colors.text.secondary },
  DUE:      { labelKey: 'medications.status.due',      bg: colors.warningBg,  text: colors.warning },
  UPCOMING: { labelKey: 'medications.status.upcoming', bg: colors.primaryBg,  text: colors.primary },
  NONE:     { labelKey: 'medications.status.noLog',    bg: colors.bg.subtle,  text: colors.text.muted },
};

interface Props {
  status: BadgeVariant;
}

export function DoseStatusBadge({ status }: Props) {
  const { t } = useTranslation();
  const cfg = CONFIG[status] ?? CONFIG.NONE;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.label, { color: cfg.text }]}>{t(cfg.labelKey)}</Text>
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
