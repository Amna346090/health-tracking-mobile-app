import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, shadows } from '../theme';

interface Props {
  /** 0 (not pulling) to 1 (past the trigger threshold) */
  pullProgress: number;
  refreshing: boolean;
}

export function PullToRefreshIndicator({ pullProgress, refreshing }: Props) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!refreshing) return;
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 700,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [refreshing, spin]);

  if (!refreshing && pullProgress <= 0) return null;

  const spinRotation = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const pullRotation = `${pullProgress * 180}deg`;

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={[styles.bubble, { opacity: refreshing ? 1 : pullProgress }]}>
        <Animated.View style={{ transform: [{ rotate: refreshing ? spinRotation : pullRotation }] }}>
          <Feather name="refresh-cw" size={18} color={colors.primary} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  bubble: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.bg.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
});
