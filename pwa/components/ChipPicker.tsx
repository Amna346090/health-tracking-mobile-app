import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, typography, radius } from '../theme';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  label?: string;
  options: Option<T>[];
  value: T | null;
  onChange: (v: T) => void;
}

export function ChipPicker<T extends string>({ label, options, value, onChange }: Props<T>) {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.row}>
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => onChange(opt.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { ...(typography.label as object), color: colors.text.secondary },
  row: { flexDirection: 'row', flexWrap: 'wrap' as const, gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg.card,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg,
  },
  chipLabel: { ...(typography.body2 as object), color: colors.text.secondary },
  chipLabelSelected: { color: colors.primary, fontWeight: '600' as const },
});
