import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Alert } from '../lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, spacing, typography } from '../theme';
import { Button } from '../components/Button';
import { DateField } from '../components/DateField';
import { Input } from '../components/Input';
import { ChipPicker } from '../components/ChipPicker';
import { registerApi } from '../api/auth';
import type { Gender } from '../api/auth';

interface FormValues {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender | null;
  healthIssue: string;
  phone: string;
}

export default function AddPatientScreen() {
  const { t } = useTranslation();
  const GENDER_OPTIONS: { value: Gender; label: string }[] = [
    { value: 'MALE', label: t('patientForm.male') },
    { value: 'FEMALE', label: t('patientForm.female') },
    { value: 'OTHER', label: t('patientForm.other') },
    { value: 'PREFER_NOT_TO_SAY', label: t('profile.preferNotToSay') },
  ];

  const router = useRouter();

  const [values, setValues] = useState<FormValues>({
    firstName: '', lastName: '',
    dateOfBirth: '', gender: null, healthIssue: '', phone: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>> & { form?: string }>({});
  const [saving, setSaving] = useState(false);

  function set(field: keyof FormValues) {
    return (text: string) => setValues((v) => ({ ...v, [field]: text }));
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!values.firstName.trim()) next.firstName = t('patientForm.firstNameRequired');
    if (!values.phone.trim()) next.phone = t('patientForm.phoneRequired');
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
        phone: values.phone.trim(),
        lastName: values.lastName.trim() || undefined,
        dateOfBirth: values.dateOfBirth.trim() || undefined,
        gender: values.gender ?? undefined,
        healthIssue: values.healthIssue.trim() || undefined,
        role: 'PATIENT',
      });

      function goToPatient() {
        if (created.patientProfile) {
          router.replace(`/patient-dashboard/${created.patientProfile.id}`);
        } else {
          router.back();
        }
      }

      Alert.alert(t('patientForm.patientCreated'), undefined, [{ text: t('changePassword.ok'), onPress: goToPatient }]);
    } catch (err) {
      setErrors({ form: (err as Error).message ?? t('patientForm.createFailed') });
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
              <Text style={styles.backText}>{t('patientForm.cancelWithArrow')}</Text>
            </Pressable>
            <Text style={styles.navTitle}>{t('patientForm.addTitle')}</Text>
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
                label={t('patientForm.firstName')}
                value={values.firstName}
                onChangeText={set('firstName')}
                error={errors.firstName}
                autoCapitalize="words"
                containerStyle={styles.halfInput}
              />
              <Input
                label={t('patientForm.lastNameOptional')}
                value={values.lastName}
                onChangeText={set('lastName')}
                error={errors.lastName}
                autoCapitalize="words"
                containerStyle={styles.halfInput}
              />
            </View>

            <Input
              label={t('patientForm.phone')}
              value={values.phone}
              onChangeText={set('phone')}
              error={errors.phone}
              keyboardType="phone-pad"
            />

            <DateField
              label={t('patientForm.dobOptional')}
              value={values.dateOfBirth}
              onChange={(date) => setValues((v) => ({ ...v, dateOfBirth: date }))}
              error={errors.dateOfBirth}
              maximumDate={new Date()}
            />

            <ChipPicker
              label={t('patientForm.genderOptional')}
              options={GENDER_OPTIONS}
              value={values.gender}
              onChange={(gender) => setValues((v) => ({ ...v, gender }))}
            />

            <Input
              label={t('patientForm.healthIssueOptional')}
              value={values.healthIssue}
              onChangeText={set('healthIssue')}
              placeholder={t('patientForm.healthIssuePlaceholder')}
              onSubmitEditing={handleSave}
            />

            <Button label={t('patientForm.createPatient')} onPress={handleSave} loading={saving} />
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
