import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, radius, shadows, spacing, typography } from '../theme';
import { storeLanguage, type SupportedLanguage } from '../i18n';

const OPTIONS: { code: SupportedLanguage; labelKey: string }[] = [
  { code: 'en', labelKey: 'language.english' },
  { code: 'es', labelKey: 'language.spanish' },
];

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  function choose(code: SupportedLanguage) {
    i18n.changeLanguage(code);
    storeLanguage(code);
    setOpen(false);
  }

  return (
    <>
      <Pressable
        style={styles.button}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('language.label')}
      >
        <Feather name="globe" size={19} color={colors.text.primary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.menu}>
            {OPTIONS.map((opt) => {
              const active = i18n.language === opt.code;
              return (
                <Pressable
                  key={opt.code}
                  style={styles.option}
                  onPress={() => choose(opt.code)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {t(opt.labelKey)}
                  </Text>
                  {active && <Feather name="check" size={18} color={colors.primary} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bg.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'flex-end',
    padding: spacing.lg,
    paddingTop: 90,
  },
  menu: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    minWidth: 160,
    ...shadows.lg,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  optionText: { ...typography.body1, color: colors.text.primary },
  optionTextActive: { color: colors.primary, fontWeight: '600' as const },
});
