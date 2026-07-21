import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { colors, radius, shadows, spacing, typography } from '../theme';

interface TimeFieldProps {
  label: string;
  value: string; // HH:mm
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
}

function toDate(value: string): Date | null {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`2000-01-01T${value}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDisplay(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function TimeField({
  label,
  value,
  onChange,
  error,
  hint,
  placeholder = 'Select a time',
}: TimeFieldProps) {
  const [show, setShow] = useState(false);
  const selected = toDate(value);

  function handleChange(event: DateTimePickerEvent, picked?: Date) {
    if (Platform.OS === 'android') setShow(false);
    if (event.type === 'set' && picked) {
      onChange(formatValue(picked));
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
        <Feather name="clock" size={18} color={colors.text.secondary} />
      </Pressable>
      {!!error && <Text style={styles.errorText} accessibilityRole="alert">{error}</Text>}
      {!!hint && !error && <Text style={styles.hintText}>{hint}</Text>}

      {show && (
        <DateTimePicker
          value={selected ?? new Date()}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
          onChange={handleChange}
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
