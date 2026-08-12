import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, shadows, spacing } from '../theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 'raised' (default) adds a drop-shadow; 'outlined' uses a border instead. */
  variant?: 'raised' | 'outlined';
  padding?: number;
}

export function Card({ children, style, variant = 'raised', padding = spacing.md }: CardProps) {
  return (
    <View style={[styles.base, variant === 'raised' ? styles.raised : styles.outlined, { padding }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
  },
  raised: {
    ...shadows.md,
  },
  outlined: {
    borderWidth: 1,
    borderColor: colors.border,
  },
});
