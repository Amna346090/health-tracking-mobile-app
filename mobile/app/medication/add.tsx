import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, typography, radius, shadows } from '../../theme';
import { createMedication } from '../../api/medications';
import type { MedicationForm, FoodInstruction } from '../../api/medications';
import { ChipPicker } from '../../components/ChipPicker';

const FORM_OPTIONS: { value: MedicationForm; label: string }[] = [
  { value: 'TABLET', label: 'Tablet' },
  { value: 'CAPSULE', label: 'Capsule' },
  { value: 'LIQUID', label: 'Liquid' },
  { value: 'INJECTION', label: 'Injection' },
  { value: 'TOPICAL', label: 'Topical' },
  { value: 'OTHER', label: 'Other' },
];

const FOOD_OPTIONS: { value: FoodInstruction; label: string }[] = [
  { value: 'WITH_FOOD', label: 'With food' },
  { value: 'WITHOUT_FOOD', label: 'Without food' },
  { value: 'EITHER', label: 'Either' },
];

export default function AddMedicationScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [form, setForm] = useState<MedicationForm | null>(null);
  const [quantityPerDose, setQuantityPerDose] = useState('');
  const [foodInstruction, setFoodInstruction] = useState<FoodInstruction | null>(null);
  const [instructions, setInstructions] = useState('');
  const [prescribingNotes, setPrescribingNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const canSubmit = name.trim().length > 0 && dosage.trim().length > 0;

  const handleSave = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const quantity = quantityPerDose.trim() ? parseInt(quantityPerDose.trim(), 10) : undefined;
      await createMedication({
        name: name.trim(),
        dosage: dosage.trim(),
        form: form ?? undefined,
        quantityPerDose: quantity && !isNaN(quantity) ? quantity : undefined,
        foodInstruction: foodInstruction ?? undefined,
        instructions: instructions.trim() || undefined,
        prescribingNotes: prescribingNotes.trim() || undefined,
      });
      router.back();
    } catch (e) {
      Alert.alert('Failed to create medication', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
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
              <Text style={styles.backText}>← Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.navTitle}>Add Medication</Text>
            <View style={styles.navSpacer} />
          </View>

          <View style={styles.form}>
            <Field
              label="Name *"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Metformin"
              autoCapitalize="words"
            />
            <Field
              label="Dosage *"
              value={dosage}
              onChangeText={setDosage}
              placeholder="e.g. 500mg twice daily"
            />
            <ChipPicker label="Form" options={FORM_OPTIONS} value={form} onChange={setForm} />
            <Field
              label="Quantity per dose"
              value={quantityPerDose}
              onChangeText={setQuantityPerDose}
              placeholder="e.g. 2 (tablets)"
              keyboardType="number-pad"
            />
            <ChipPicker
              label="Food instruction"
              options={FOOD_OPTIONS}
              value={foodInstruction}
              onChange={setFoodInstruction}
            />
            <Field
              label="Instructions"
              value={instructions}
              onChangeText={setInstructions}
              placeholder="e.g. Take with food"
              multiline
            />
            <Field
              label="Prescribing notes"
              value={prescribingNotes}
              onChangeText={setPrescribingNotes}
              placeholder="Internal notes for care team"
              multiline
            />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, (!canSubmit || saving) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSubmit || saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <Text style={styles.saveBtnText}>Save Medication</Text>
            )}
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
