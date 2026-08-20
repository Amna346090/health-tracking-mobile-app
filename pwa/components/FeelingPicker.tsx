import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, typography, radius } from '../theme';
import type { FeelingStatus } from '../api/healthLog';

const OPTIONS: { value: FeelingStatus; emoji: string; label: string }[] = [
  { value: 'GREAT',    emoji: '😄', label: 'Great'    },
  { value: 'GOOD',     emoji: '🙂', label: 'Good'     },
  { value: 'OKAY',     emoji: '😐', label: 'Okay'     },
  { value: 'POOR',     emoji: '😟', label: 'Poor'     },
  { value: 'TERRIBLE', emoji: '😢', label: 'Terrible' },
];

interface Props {
  value: FeelingStatus | null;
  onChange: (v: FeelingStatus | null) => void;
}

export function FeelingPicker({ value, onChange }: Props) {
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
            <Text style={[styles.label, selected && styles.labelSelected]}>{opt.label}</Text>
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
