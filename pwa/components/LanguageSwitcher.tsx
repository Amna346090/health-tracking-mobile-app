import { useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, radius, shadows, spacing, typography } from '../theme';
import { storeLanguage, type SupportedLanguage } from '../i18n';

const OPTIONS: { code: SupportedLanguage; labelKey: string }[] = [
  { code: 'en', labelKey: 'language.english' },
  { code: 'es', labelKey: 'language.spanish' },
];

const MENU_WIDTH = 160;

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const buttonRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ top: 0, left: 0 });

  function openMenu() {
    // Anchor the menu to the button's actual on-screen position rather than the
    // edge of the viewport — the app content is a centered column on wide screens,
    // so viewport-edge alignment puts the menu far away from the button there.
    buttonRef.current?.measureInWindow((x, y, width, height) => {
      const screenWidth = Dimensions.get('window').width;
      const left = Math.min(Math.max(x + width - MENU_WIDTH, 8), screenWidth - MENU_WIDTH - 8);
      setAnchor({ top: y + height + 6, left });
      setOpen(true);
    });
  }

  function choose(code: SupportedLanguage) {
    i18n.changeLanguage(code);
    storeLanguage(code);
    setOpen(false);
  }

  return (
    <>
      <Pressable
        ref={buttonRef}
        style={styles.button}
        onPress={openMenu}
        accessibilityRole="button"
        accessibilityLabel={t('language.label')}
      >
        <Feather name="globe" size={19} color={colors.text.primary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.menu, { top: anchor.top, left: anchor.left }]}>
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
  },
  menu: {
    position: 'absolute',
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    width: MENU_WIDTH,
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
