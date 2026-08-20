import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
  Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, shadows, spacing, typography } from '../theme';

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
  containerStyle?: ViewStyle;
}

export function Input({ label, error, hint, containerStyle, ...textInputProps }: InputProps) {
  const [focused, setFocused] = useState(false);
  const [secureVisible, setSecureVisible] = useState(false);

  const isSecure = textInputProps.secureTextEntry && !secureVisible;

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={styles.label} accessibilityRole="text">
        {label}
      </Text>
      <View style={[styles.inputWrapper, focused && styles.inputFocused, !!error && styles.inputError]}>
        <TextInput
          {...textInputProps}
          secureTextEntry={isSecure}
          onFocus={(e) => { setFocused(true); textInputProps.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); textInputProps.onBlur?.(e); }}
          style={[styles.input, textInputProps.secureTextEntry && styles.inputWithToggle]}
          placeholderTextColor={colors.text.muted}
          textAlignVertical="center"
          accessibilityLabel={label}
          accessibilityHint={hint}
        />
        {textInputProps.secureTextEntry && (
          <Pressable
            onPress={() => setSecureVisible((v) => !v)}
            style={styles.eyeButton}
            accessibilityLabel={secureVisible ? 'Hide password' : 'Show password'}
            hitSlop={8}
          >
            <Feather
              name={secureVisible ? 'eye-off' : 'eye'}
              size={18}
              color={colors.text.secondary}
            />
          </Pressable>
        )}
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
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.input,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    height: 48,
    ...shadows.sm,
  },
  inputFocused: {
    borderColor: colors.borderFocus,
    backgroundColor: colors.bg.card,
  },
  inputError: {
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
    ...typography.body1,
    color: colors.text.primary,
  },
  inputWithToggle: {
    paddingRight: spacing.xs,
  },
  eyeButton: {
    paddingHorizontal: spacing.md,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
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
