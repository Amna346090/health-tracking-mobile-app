import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/auth';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { colors, spacing, typography } from '../../theme';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ identifier?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const next: typeof errors = {};
    if (!identifier.trim()) next.identifier = t('auth.emailRequired');
    if (!password) next.password = t('auth.passwordRequired');
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleLogin() {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      await login(identifier.trim().toLowerCase(), password);
      // NavigationGuard redirects to (tabs) automatically
    } catch (err) {
      setErrors({ form: (err as Error).message ?? t('auth.loginFailed') });
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>💊</Text>
            <Text style={styles.title}>SFLBiotrack</Text>
            <Text style={styles.subtitle}>{t('auth.appTagline')}</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {errors.form && (
              <View style={styles.formError}>
                <Text style={styles.formErrorText}>{errors.form}</Text>
              </View>
            )}

            <Input
              label={t('auth.emailOrUsername')}
              value={identifier}
              onChangeText={setIdentifier}
              error={errors.identifier}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              placeholder={t('auth.emailOrUsernamePlaceholder')}
              returnKeyType="next"
            />

            <Input
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              secureTextEntry
              autoComplete="password"
              placeholder="••••••••"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />

            <Button label={t('auth.signIn')} onPress={handleLogin} loading={loading} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.app,
  },
  keyboardView: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  logo: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body1,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  form: {
    gap: spacing.md,
  },
  formError: {
    backgroundColor: colors.dangerBg,
    borderRadius: 8,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },
  formErrorText: {
    ...typography.body2,
    color: colors.danger,
  },
});
