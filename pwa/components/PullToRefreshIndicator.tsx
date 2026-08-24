import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, shadows } from '../theme';

interface Props {
  /** 0 (not pulling) to 1 (past the trigger threshold) */
  pullProgress: number;
  refreshing: boolean;
}

export function PullToRefreshIndicator({ pullProgress, refreshing }: Props) {
  if (!refreshing && pullProgress <= 0) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={[styles.bubble, { opacity: refreshing ? 1 : pullProgress }]}>
        {refreshing ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Feather
            name="arrow-down"
            size={16}
            color={colors.primary}
            style={{ transform: [{ rotate: `${pullProgress * 180}deg` }] }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 6,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  bubble: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.bg.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
});
