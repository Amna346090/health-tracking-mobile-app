import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Alert } from '../lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '../theme';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { changePassword } from '../api/notifications';
import { ApiError } from '../api/client';

interface FormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function ChangePasswordScreen() {
  const router = useRouter();

  const [values, setValues] = useState<FormValues>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>> & { form?: string }>({});
  const [loading, setLoading] = useState(false);

  function set(field: keyof FormValues) {
    return (text: string) => setValues((v) => ({ ...v, [field]: text }));
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!values.currentPassword) next.currentPassword = 'Current password is required';
    if (!values.newPassword) next.newPassword = 'New password is required';
    else if (values.newPassword.length < 8) next.newPassword = 'Must be at least 8 characters';
    if (values.confirmPassword !== values.newPassword) next.confirmPassword = 'Passwords do not match';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      await changePassword(values.currentPassword, values.newPassword);
      Alert.alert('Password changed', 'Your password has been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not change password.';
      setErrors({ form: message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.navBar}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.backText}>← Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.navTitle}>Change Password</Text>
            <View style={{ width: 60 }} />
          </View>

          <View style={styles.form}>
            {errors.form && (
              <View style={styles.formError}>
                <Text style={styles.formErrorText}>{errors.form}</Text>
              </View>
            )}

            <Input
              label="Current password"
              value={values.currentPassword}
              onChangeText={set('currentPassword')}
              error={errors.currentPassword}
              secureTextEntry
              autoComplete="current-password"
              returnKeyType="next"
            />
            <Input
              label="New password"
              value={values.newPassword}
              onChangeText={set('newPassword')}
              error={errors.newPassword}
              secureTextEntry
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              returnKeyType="next"
            />
            <Input
              label="Confirm new password"
              value={values.confirmPassword}
              onChangeText={set('confirmPassword')}
              error={errors.confirmPassword}
              secureTextEntry
              autoComplete="new-password"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            <Button label="Update password" onPress={handleSubmit} loading={loading} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.app },
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  backText: { ...typography.body1, color: colors.primary },
  navTitle: { ...typography.h4, color: colors.text.primary },

  form: { gap: spacing.md },

  formError: {
    backgroundColor: colors.dangerBg,
    borderRadius: 8,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },
  formErrorText: { ...typography.body2, color: colors.danger },
});
