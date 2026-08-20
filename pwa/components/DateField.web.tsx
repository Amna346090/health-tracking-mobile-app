import React, { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadows, spacing, typography } from '../theme';

interface DateFieldProps {
  label: string;
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  maximumDate?: Date;
  minimumDate?: Date;
}

function toIsoDate(d?: Date): string | undefined {
  if (!d) return undefined;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// @react-native-community/datetimepicker has no web implementation (renders null,
// logs a warning) — this uses the browser's own native <input type="date"> instead.
// The stored value format (YYYY-MM-DD) already matches what that input expects.
export function DateField({
  label,
  value,
  onChange,
  error,
  hint,
  maximumDate,
  minimumDate,
}: DateFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <View style={styles.container}>
      <Text style={styles.label} accessibilityRole="text">
        {label}
      </Text>
      <View style={[styles.fieldWrapper, !!error && styles.fieldError]}>
        {React.createElement('input', {
          ref: inputRef,
          type: 'date',
          value: value || '',
          max: toIsoDate(maximumDate),
          min: toIsoDate(minimumDate),
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
          'aria-label': label,
          style: {
            flex: 1,
            minWidth: 0,
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
