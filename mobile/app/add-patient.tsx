import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '../theme';
import { Button } from '../components/Button';
import { DateField } from '../components/DateField';
import { Input } from '../components/Input';
import { ChipPicker } from '../components/ChipPicker';
import { registerApi } from '../api/auth';
import type { Gender } from '../api/auth';

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

export default function AddPatientScreen() {
  const router = useRouter();

  const [values, setValues] = useState<FormValues>({
    firstName: '', lastName: '', email: '', password: '',
    dateOfBirth: '', gender: null, healthIssue: '', phone: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>> & { form?: string }>({});
  const [saving, setSaving] = useState(false);

  function set(field: keyof FormValues) {
    return (text: string) => setValues((v) => ({ ...v, [field]: text }));
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!values.firstName.trim()) next.firstName = 'First name is required';
    if (!values.lastName.trim()) next.lastName = 'Last name is required';
    if (!values.email.trim()) next.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) next.email = 'Enter a valid email';
    if (!values.password) next.password = 'Password is required';
    else if (values.password.length < 8) next.password = 'Password must be at least 8 characters';
    if (!values.dateOfBirth.trim()) next.dateOfBirth = 'Date of birth is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setErrors({});
    try {
      const created = await registerApi({
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
      if (created.patientProfile) {
        router.replace(`/patient-dashboard/${created.patientProfile.id}`);
      } else {
        router.back();
      }
    } catch (err) {
      setErrors({ form: (err as Error).message ?? 'Could not create patient.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.navBar}>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.backText}>← Cancel</Text>
            </Pressable>
            <Text style={styles.navTitle}>Add Patient</Text>
            <View style={{ width: 60 }} />
          </View>

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
                containerStyle={styles.halfInput}
              />
              <Input
                label="Last name"
                value={values.lastName}
                onChangeText={set('lastName')}
                error={errors.lastName}
                autoCapitalize="words"
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
            />

            <Input
              label="Initial password"
              value={values.password}
              onChangeText={set('password')}
              error={errors.password}
              secureTextEntry
              placeholder="Min. 8 characters"
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
              placeholder="e.g. Type 2 Diabetes"
            />

            <Input
              label="Phone (optional)"
              value={values.phone}
              onChangeText={set('phone')}
              keyboardType="phone-pad"
              onSubmitEditing={handleSave}
            />

            <Button label="Create patient" onPress={handleSave} loading={saving} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.app },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  backText: { ...typography.body1, color: colors.primary },
  navTitle: { ...typography.h4, color: colors.text.primary },

  form: { gap: spacing.md, marginBottom: spacing.xl },
  row: { flexDirection: 'row', gap: spacing.sm },
  halfInput: { flex: 1 },

  formError: {
    backgroundColor: colors.dangerBg,
    borderRadius: 8,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },
  formErrorText: { ...typography.body2, color: colors.danger },
});
