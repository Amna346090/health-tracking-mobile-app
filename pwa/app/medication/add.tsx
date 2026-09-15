import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, spacing, typography, radius, shadows } from '../../theme';
import type { MedicationForm, FoodInstruction } from '../../api/medications';
import { createMedicationOffline } from '../../offline/entities/medications';
import { ChipPicker } from '../../components/ChipPicker';

export default function AddMedicationScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const FORM_OPTIONS: { value: MedicationForm; label: string }[] = [
    { value: 'TABLET', label: t('medications.formLabel.TABLET') },
    { value: 'CAPSULE', label: t('medications.formLabel.CAPSULE') },
    { value: 'LIQUID', label: t('medications.formLabel.LIQUID') },
    { value: 'INJECTION', label: t('medications.formLabel.INJECTION') },
    { value: 'TOPICAL', label: t('medications.formLabel.TOPICAL') },
    { value: 'OTHER', label: t('medications.formLabel.OTHER') },
  ];

  const FOOD_OPTIONS: { value: FoodInstruction; label: string }[] = [
    { value: 'WITH_FOOD', label: t('medicationForm.foodOptions.withFood') },
    { value: 'WITHOUT_FOOD', label: t('medicationForm.foodOptions.withoutFood') },
    { value: 'EITHER', label: t('medicationForm.foodOptions.either') },
  ];

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [form, setForm] = useState<MedicationForm | null>(null);
  const [quantityPerDose, setQuantityPerDose] = useState('');
  const [foodInstruction, setFoodInstruction] = useState<FoodInstruction | null>(null);
  const [instructions, setInstructions] = useState('');
  const [prescribingNotes, setPrescribingNotes] = useState('');

  const canSubmit = name.trim().length > 0;

  // Saved to local storage and reflected immediately; syncs to the server right away if
  // online, or as soon as the connection comes back if not.
  const handleSave = async () => {
    if (!canSubmit) return;
    const quantity = quantityPerDose.trim() ? parseInt(quantityPerDose.trim(), 10) : undefined;
    await createMedicationOffline({
      name: name.trim(),
      dosage: dosage.trim() || undefined,
      form: form ?? undefined,
      quantityPerDose: quantity && !isNaN(quantity) ? quantity : undefined,
      foodInstruction: foodInstruction ?? undefined,
      instructions: instructions.trim() || undefined,
      prescribingNotes: prescribingNotes.trim() || undefined,
    });
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.navBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backText}>{t('medicationForm.cancelWithArrow')}</Text>
            </TouchableOpacity>
            <Text style={styles.navTitle}>{t('medicationForm.addTitle')}</Text>
            <View style={styles.navSpacer} />
          </View>

          <View style={styles.form}>
            <Field
              label={t('medicationForm.nameLabel')}
              value={name}
              onChangeText={setName}
              placeholder={t('medicationForm.namePlaceholder')}
              autoCapitalize="words"
            />
            <Field
              label={t('medicationForm.dosageLabel')}
              value={dosage}
              onChangeText={setDosage}
              placeholder={t('medicationForm.dosagePlaceholder')}
            />
            <ChipPicker label={t('medicationForm.formFieldLabel')} options={FORM_OPTIONS} value={form} onChange={setForm} />
            <Field
              label={t('medicationForm.quantityLabel')}
              value={quantityPerDose}
              onChangeText={setQuantityPerDose}
              placeholder={t('medicationForm.quantityPlaceholder')}
              keyboardType="number-pad"
            />
            <ChipPicker
              label={t('medicationForm.foodFieldLabel')}
              options={FOOD_OPTIONS}
              value={foodInstruction}
              onChange={setFoodInstruction}
            />
            <Field
              label={t('medicationForm.instructionsLabel')}
              value={instructions}
              onChangeText={setInstructions}
              placeholder={t('medicationForm.instructionsPlaceholder')}
              multiline
            />
            <Field
              label={t('medicationForm.notesLabel')}
              value={prescribingNotes}
              onChangeText={setPrescribingNotes}
              placeholder={t('medicationForm.notesPlaceholder')}
              multiline
            />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, !canSubmit && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSubmit}
            activeOpacity={0.8}
          >
            <Text style={styles.saveBtnText}>{t('medicationForm.savePeptide')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  autoCapitalize,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'number-pad';
}) {
  return (
    <View style={fieldStyles.container}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={[fieldStyles.input, multiline && fieldStyles.multiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text.muted}
        multiline={multiline}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        textAlignVertical={multiline ? 'top' : 'center'}
        keyboardType={keyboardType ?? 'default'}
      />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { ...typography.label, color: colors.text.secondary },
  input: {
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body2,
    color: colors.text.primary,
    ...shadows.sm,
  },
  multiline: { minHeight: 80, paddingTop: spacing.sm },
});

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
  backBtn: {},
  backText: { ...typography.body1, color: colors.primary },
  navTitle: { ...typography.h4, color: colors.text.primary },
  navSpacer: { width: 60 },

  form: { gap: spacing.md, marginBottom: spacing.xl },

  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...shadows.md,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { ...typography.body1, fontWeight: '600' as const, color: colors.text.inverse },
});
