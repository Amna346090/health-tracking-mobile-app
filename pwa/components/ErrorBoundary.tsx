import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing, typography, radius } from '../theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Without this, an unexpected error anywhere in the app's screens leaves the whole page
 * permanently blank — React unmounts everything and there's nothing left to show a retry
 * option, so the only way out is fully closing and reopening the app. This catches that and
 * shows a recoverable screen instead, so a bug in one screen can never strand the admin.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('Unhandled error caught by ErrorBoundary:', error, info.componentStack);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  handleReload = (): void => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
    } else {
      this.setState({ hasError: false });
    }
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>
            This screen ran into a problem. Your saved data is safe — try one of these to continue.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={this.handleRetry}>
            <Text style={styles.primaryBtnText}>Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={this.handleReload}>
            <Text style={styles.secondaryBtnText}>Reload app</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.app,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { ...(typography.h3 as object), color: colors.text.primary, textAlign: 'center' },
  body: { ...(typography.body2 as object), color: colors.text.secondary, textAlign: 'center', marginBottom: spacing.sm },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  primaryBtnText: { ...(typography.body1 as object), color: colors.text.inverse, fontWeight: '600' as const },
  secondaryBtn: { paddingVertical: spacing.sm },
  secondaryBtnText: { ...(typography.body2 as object), color: colors.text.muted },
});
