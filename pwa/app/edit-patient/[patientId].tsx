import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, spacing, typography } from '../../theme';
import { Button } from '../../components/Button';
import { DateField } from '../../components/DateField';
import { Input } from '../../components/Input';
import { ChipPicker } from '../../components/ChipPicker';
import { getPatientById, updatePatient } from '../../api/patients';
import { getAllProviders } from '../../api/providers';
import type { Provider } from '../../api/providers';
import type { Gender } from '../../api/auth';
import { STAFF_FEATURES_ENABLED } from '../../config';

interface FormValues {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender | null;
  healthIssue: string;
  phone: string;
  address: string;
  providerId: number | null;
}

export default function EditPatientScreen() {
  const { t } = useTranslation();
  const GENDER_OPTIONS: { value: Gender; label: string }[] = [
    { value: 'MALE', label: t('patientForm.male') },
    { value: 'FEMALE', label: t('patientForm.female') },
    { value: 'OTHER', label: t('patientForm.other') },
    { value: 'PREFER_NOT_TO_SAY', label: t('profile.preferNotToSay') },
  ];
  const router = useRouter();
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const pid = Number(patientId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<FormValues | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPatientById(pid)
      .then((p) => {
        setValues({
          firstName: p.user.firstName,
          lastName: p.user.lastName,
          dateOfBirth: p.dateOfBirth?.slice(0, 10) ?? '',
          gender: p.gender,
          healthIssue: p.healthIssue ?? '',
          phone: p.phone ?? '',
          address: p.address ?? '',
          providerId: p.providerId,
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : t('patientForm.failedToLoad')))
      .finally(() => setLoading(false));
    if (STAFF_FEATURES_ENABLED) getAllProviders().then(setProviders).catch(() => {});
  }, [pid]);

  function set(field: keyof FormValues) {
    return (text: string) => setValues((v) => (v ? { ...v, [field]: text } : v));
  }

  async function handleSave() {
    if (!values) return;
    setSaving(true);
    try {
      await updatePatient(pid, {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        ...(values.dateOfBirth.trim() && { dateOfBirth: values.dateOfBirth.trim() }),
        gender: values.gender,
        healthIssue: values.healthIssue.trim() || null,
        phone: values.phone.trim() || null,
        address: values.address.trim() || null,
        providerId: values.providerId,
      });
      router.back();
    } catch (e) {
      Alert.alert(t('patientForm.saveFailed'), e instanceof Error ? e.message : t('common.pleaseTryAgain'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (error || !values) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.navBar}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backText}>{t('common.backWithArrow')}</Text>
          </Pressable>
        </View>
        <View style={styles.center}>
          <Text style={styles.formErrorText}>{error ?? t('patientForm.patientNotFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.navBar}>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.backText}>{t('patientForm.cancelWithArrow')}</Text>
            </Pressable>
            <Text style={styles.navTitle}>{t('patientForm.editTitle')}</Text>
            <View style={{ width: 60 }} />
          </View>

          <View style={styles.form}>
            <View style={styles.row}>
              <Input label={t('patientForm.firstName')} value={values.firstName} onChangeText={set('firstName')} containerStyle={styles.halfInput} />
              <Input label={t('patientForm.lastName')} value={values.lastName} onChangeText={set('lastName')} containerStyle={styles.halfInput} />
            </View>

            <DateField
              label={t('patientForm.dob')}
              value={values.dateOfBirth}
              onChange={(date) => setValues((v) => (v ? { ...v, dateOfBirth: date } : v))}
              maximumDate={new Date()}
            />

            <ChipPicker
              label={t('profile.gender')}
              options={GENDER_OPTIONS}
              value={values.gender}
              onChange={(gender) => setValues((v) => (v ? { ...v, gender } : v))}
            />

            <Input label={t('patientForm.healthIssue')} value={values.healthIssue} onChangeText={set('healthIssue')} />
            <Input label={t('patientForm.phone')} value={values.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
            <Input label={t('profile.address')} value={values.address} onChangeText={set('address')} />

            {STAFF_FEATURES_ENABLED && (
              <ChipPicker
                label={t('patientForm.assignedProvider')}
                options={[
                  { value: '', label: t('patientDashboard.unassigned') },
                  ...providers.map((p) => ({ value: String(p.id), label: `${p.user.firstName} ${p.user.lastName}` })),
                ]}
                value={values.providerId ? String(values.providerId) : ''}
                onChange={(v) => setValues((cur) => (cur ? { ...cur, providerId: v ? Number(v) : null } : cur))}
              />
            )}

            <Button label={t('appointments.saveChanges')} onPress={handleSave} loading={saving} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.app },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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

  formErrorText: { ...typography.body2, color: colors.danger },
});
