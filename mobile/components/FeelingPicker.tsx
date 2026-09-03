import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, typography, radius } from '../theme';
import type { FeelingStatus } from '../api/healthLog';

const OPTIONS: { value: FeelingStatus; emoji: string; labelKey: string }[] = [
  { value: 'GREAT',    emoji: '😄', labelKey: 'feeling.great'    },
  { value: 'GOOD',     emoji: '🙂', labelKey: 'feeling.good'     },
  { value: 'OKAY',     emoji: '😐', labelKey: 'feeling.okay'     },
  { value: 'POOR',     emoji: '😟', labelKey: 'feeling.poor'     },
  { value: 'TERRIBLE', emoji: '😢', labelKey: 'feeling.terrible' },
];

interface Props {
  value: FeelingStatus | null;
  onChange: (v: FeelingStatus | null) => void;
}

export function FeelingPicker({ value, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      {OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.option, selected && styles.optionSelected]}
            onPress={() => onChange(selected ? null : opt.value)}
            activeOpacity={0.7}
          >
            <Text style={styles.emoji}>{opt.emoji}</Text>
            <Text style={[styles.label, selected && styles.labelSelected]}>{t(opt.labelKey)}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export const FEELING_EMOJI: Record<FeelingStatus, string> = {
  GREAT:    '😄',
  GOOD:     '🙂',
  OKAY:     '😐',
  POOR:     '😟',
  TERRIBLE: '😢',
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg.card,
    gap: 2,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg,
  },
  emoji: { fontSize: 20 },
  label: {
    ...(typography.caption as object),
    color: colors.text.muted,
  },
  labelSelected: {
    color: colors.primary,
    fontWeight: '600' as const,
  },
});
