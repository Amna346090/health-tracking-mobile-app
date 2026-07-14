import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { useAuth } from '../../context/auth';
import { Button } from '../../components/Button';
import { DateField } from '../../components/DateField';
import { Input } from '../../components/Input';
import { ChipPicker } from '../../components/ChipPicker';
import { colors, spacing, typography } from '../../theme';
import type { Gender } from '../../api/auth';

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
];

interface FormValues {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  dateOfBirth: string;
  gender: Gender | null;
  healthIssue: string;
  phone: string;
}

interface FormErrors extends Partial<Record<keyof FormValues, string>> {
  form?: string;
}

export default function RegisterScreen() {
  const { register } = useAuth();

  const [values, setValues] = useState<FormValues>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    dateOfBirth: '',
    gender: null,
    healthIssue: '',
    phone: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  function set(field: keyof FormValues) {
    return (text: string) => setValues((v) => ({ ...v, [field]: text }));
  }

  function validate(): boolean {
    const next: FormErrors = {};
    if (!values.firstName.trim()) next.firstName = 'First name is required';
    if (!values.lastName.trim()) next.lastName = 'Last name is required';
    if (!values.email.trim()) next.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) next.email = 'Enter a valid email';
    if (!values.password) next.password = 'Password is required';
    else if (values.password.length < 8) next.password = 'Password must be at least 8 characters';
    if (!values.dateOfBirth.trim()) {
      next.dateOfBirth = 'Date of birth is required';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleRegister() {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      await register({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
        dateOfBirth: values.dateOfBirth.trim(),
        gender: values.gender ?? undefined,
        healthIssue: values.healthIssue.trim() || undefined,
        phone: values.phone.trim() || undefined,
        role: 'PATIENT',
      });
      // NavigationGuard redirects to (tabs) automatically
    } catch (err) {
      setErrors({ form: (err as Error).message ?? 'Registration failed. Please try again.' });
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
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Track your health and medications in one place</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {errors.form && (
              <View style={styles.formError}>
                <Text style={styles.formErrorText}>{errors.form}</Text>
              </View>
            )}

            <View style={styles.row}>
              <Input
                label="First name"
                value={values.firstName}
                onChangeText={set('firstName')}
                error={errors.firstName}
                autoCapitalize="words"
                autoComplete="given-name"
                placeholder="Jane"
                returnKeyType="next"
                containerStyle={styles.halfInput}
              />
              <Input
                label="Last name"
                value={values.lastName}
                onChangeText={set('lastName')}
                error={errors.lastName}
                autoCapitalize="words"
                autoComplete="family-name"
                placeholder="Doe"
                returnKeyType="next"
                containerStyle={styles.halfInput}
              />
            </View>

            <Input
              label="Email"
              value={values.email}
              onChangeText={set('email')}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              placeholder="you@example.com"
              returnKeyType="next"
            />

            <Input
              label="Password"
              value={values.password}
              onChangeText={set('password')}
              error={errors.password}
              secureTextEntry
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              returnKeyType="next"
            />

            <DateField
              label="Date of birth"
              value={values.dateOfBirth}
              onChange={(date) => setValues((v) => ({ ...v, dateOfBirth: date }))}
              error={errors.dateOfBirth}
              maximumDate={new Date()}
            />

            <ChipPicker
              label="Gender (optional)"
              options={GENDER_OPTIONS}
              value={values.gender}
              onChange={(gender) => setValues((v) => ({ ...v, gender }))}
            />

            <Input
              label="Health issue / condition (optional)"
              value={values.healthIssue}
              onChangeText={set('healthIssue')}
              placeholder="e.g. Type 2 Diabetes, Hypertension"
              returnKeyType="next"
            />

            <Input
              label="Phone (optional)"
              value={values.phone}
              onChangeText={set('phone')}
              error={errors.phone}
              keyboardType="phone-pad"
              autoComplete="tel"
              placeholder="+1 555 000 0000"
              returnKeyType="done"
              onSubmitEditing={handleRegister}
            />

            <Button label="Create account" onPress={handleRegister} loading={loading} />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Link href="/(auth)/login" asChild>
              <Pressable hitSlop={8}>
                <Text style={styles.footerLink}> Sign in</Text>
              </Pressable>
            </Link>
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
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  halfInput: {
    flex: 1,
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -spacing.sm,
  },
  footerText: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  footerLink: {
    ...typography.body2,
    color: colors.primary,
    fontWeight: '600',
  },
});
