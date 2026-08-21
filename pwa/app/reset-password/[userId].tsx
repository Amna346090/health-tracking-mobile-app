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
import { Alert } from '../../lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, spacing, typography } from '../../theme';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { resetUserPassword } from '../../api/users';
import { ApiError } from '../../api/client';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { userId, name } = useLocalSearchParams<{ userId: string; name?: string }>();
  const targetId = Number(userId);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const next: typeof errors = {};
    if (!newPassword) next.newPassword = t('changePassword.newPasswordRequired');
    else if (newPassword.length < 8) next.newPassword = t('changePassword.minChars');
    if (confirmPassword !== newPassword) next.confirmPassword = t('changePassword.passwordsDoNotMatch');
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      await resetUserPassword(targetId, newPassword);
      Alert.alert(t('resetPassword.successTitle'), t('resetPassword.successBody', { name: name ?? t('resetPassword.theAccount') }), [
        { text: t('changePassword.ok'), onPress: () => router.back() },
      ]);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t('resetPassword.genericFailed');
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
              <Text style={styles.backText}>{t('changePassword.cancelWithArrow')}</Text>
            </TouchableOpacity>
            <Text style={styles.navTitle}>{t('resetPassword.title')}</Text>
            <View style={{ width: 60 }} />
          </View>

          {name && <Text style={styles.subtitle}>{t('resetPassword.setNewPasswordFor', { name })}</Text>}

          <View style={styles.form}>
            {errors.form && (
              <View style={styles.formError}>
                <Text style={styles.formErrorText}>{errors.form}</Text>
              </View>
            )}

            <Input
              label={t('changePassword.newPassword')}
              value={newPassword}
              onChangeText={setNewPassword}
              error={errors.newPassword}
              secureTextEntry
              autoComplete="new-password"
              placeholder={t('changePassword.minCharsPlaceholder')}
              returnKeyType="next"
            />
            <Input
              label={t('changePassword.confirmNewPassword')}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              error={errors.confirmPassword}
              secureTextEntry
              autoComplete="new-password"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            <Button label={t('resetPassword.title')} onPress={handleSubmit} loading={loading} />
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
  subtitle: { ...typography.body2, color: colors.text.secondary, marginBottom: spacing.md },

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
