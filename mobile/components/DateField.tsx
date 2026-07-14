import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
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

function toDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDisplay(d: Date): string {
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function DateField({
  label,
  value,
  onChange,
  error,
  hint,
  placeholder = 'Select a date',
  maximumDate,
  minimumDate,
}: DateFieldProps) {
  const [show, setShow] = useState(false);
  const selected = toDate(value);

  function handleChange(event: DateTimePickerEvent, picked?: Date) {
    if (Platform.OS === 'android') setShow(false);
    if (event.type === 'set' && picked) {
      onChange(formatDate(picked));
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label} accessibilityRole="text">
        {label}
      </Text>
      <Pressable
        onPress={() => setShow(true)}
        style={[styles.fieldWrapper, !!error && styles.fieldError]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
      >
        <Text style={selected ? styles.valueText : styles.placeholderText}>
          {selected ? formatDisplay(selected) : placeholder}
        </Text>
        <Feather name="calendar" size={18} color={colors.text.secondary} />
      </Pressable>
      {!!error && <Text style={styles.errorText} accessibilityRole="alert">{error}</Text>}
      {!!hint && !error && <Text style={styles.hintText}>{hint}</Text>}

      {show && (
        <DateTimePicker
          value={selected ?? maximumDate ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
          onChange={handleChange}
          maximumDate={maximumDate}
          minimumDate={minimumDate}
        />
      )}
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
  valueText: {
    ...typography.body1,
    color: colors.text.primary,
  },
  placeholderText: {
    ...typography.body1,
    color: colors.text.muted,
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
