import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, spacing, typography } from '../theme';

interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
  style?: ViewStyle;
}

export function EmptyState({ icon, title, subtitle, style }: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  icon: {
    fontSize: 36,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.h4,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body2,
    color: colors.text.muted,
    textAlign: 'center',
    maxWidth: 240,
  },
});
