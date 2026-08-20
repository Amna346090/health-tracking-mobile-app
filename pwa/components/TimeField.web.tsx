import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, shadows, spacing, typography } from '../theme';

interface TimeFieldProps {
  label: string;
  value: string; // HH:mm
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
}

// @react-native-community/datetimepicker has no web implementation (renders null,
// logs a warning) — this uses the browser's own native <input type="time"> instead.
// The stored value format (HH:mm) already matches what that input expects.
export function TimeField({ label, value, onChange, error, hint }: TimeFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label} accessibilityRole="text">
        {label}
      </Text>
      <View style={[styles.fieldWrapper, !!error && styles.fieldError]}>
        {React.createElement('input', {
          type: 'time',
          value: value || '',
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
          'aria-label': label,
          style: {
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            font: 'inherit',
            fontSize: typography.body1.fontSize,
            color: value ? colors.text.primary : colors.text.muted,
            width: '100%',
            cursor: 'pointer',
          },
        })}
        <Feather name="clock" size={18} color={colors.text.secondary} />
      </View>
      {!!error && <Text style={styles.errorText} accessibilityRole="alert">{error}</Text>}
      {!!hint && !error && <Text style={styles.hintText}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    ...typography.label,
    color: colors.text.primary,
  },
  fieldWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg.input,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    height: 48,
    paddingHorizontal: spacing.md,
    ...shadows.sm,
  },
  fieldError: {
    borderColor: colors.danger,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
  },
  hintText: {
    ...typography.caption,
    color: colors.text.muted,
  },
});
