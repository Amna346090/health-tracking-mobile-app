import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../theme';

interface Props {
  /** 0 (not pulling) to 1 (past the trigger threshold) */
  pullProgress: number;
  refreshing: boolean;
}

const SIZE = 30;
const STROKE = 2.5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SPIN_ARC = 0.28; // fraction of the ring shown while spinning, comet-style

export function PullToRefreshIndicator({ pullProgress, refreshing }: Props) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!refreshing) return;
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [refreshing, spin]);

  if (!refreshing && pullProgress <= 0) return null;

  const progress = refreshing ? SPIN_ARC : pullProgress;
  const rotation = spin.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '270deg'] });

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View
        style={{
          opacity: refreshing ? 1 : pullProgress,
          transform: [{ rotate: refreshing ? rotation : '-90deg' }],
        }}
      >
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={colors.primary}
            strokeWidth={STROKE}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
});
