import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText, G } from 'react-native-svg';
import { colors, spacing, typography, radius, shadows } from '../theme';
import type { WeightDataPoint } from '../api/healthLog';

interface Props {
  data: WeightDataPoint[];
  /** Outer width including card padding. Defaults to screen width minus 32px. */
  width?: number;
}

const PAD = { left: 44, right: 12, top: 14, bottom: 28 };
const CHART_H = 130;

export function WeightChart({ data, width: outerWidth }: Props) {
  if (data.length < 2) return null;

  const totalW = outerWidth ?? Dimensions.get('window').width - 32;
  const innerW = totalW - PAD.left - PAD.right;
  const totalH = CHART_H + PAD.top + PAD.bottom;

  const weights = data.map((d) => d.weight);
  const rawMin  = Math.min(...weights);
  const rawMax  = Math.max(...weights);
  // Add a bit of padding so the line isn't clipped at edges
  const minW = rawMin - (rawMax - rawMin) * 0.15 - 0.1;
  const maxW = rawMax + (rawMax - rawMin) * 0.15 + 0.1;
  const range = maxW - minW;

  const xAt = (i: number) => PAD.left + (i / (data.length - 1)) * innerW;
  const yAt = (w: number) => PAD.top + (1 - (w - minW) / range) * CHART_H;

  // SVG path for the weight line
  const pathD = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(d.weight).toFixed(1)}`).join(' ');

  // Y-axis: 3 guide lines
  const yTicks = [rawMin, (rawMin + rawMax) / 2, rawMax];

  // X-axis: max 4 labels spread across the data
  const xLabelIdxs: number[] = [];
  const step = Math.max(1, Math.floor((data.length - 1) / 3));
  for (let i = 0; i < data.length; i += step) xLabelIdxs.push(i);
  if (xLabelIdxs[xLabelIdxs.length - 1] !== data.length - 1) xLabelIdxs.push(data.length - 1);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Weight Trend</Text>
      <Svg width={totalW} height={totalH}>
        {/* Horizontal guide lines + Y labels */}
        {yTicks.map((w, i) => (
          <G key={i}>
            <Line
              x1={PAD.left}
              y1={yAt(w)}
              x2={PAD.left + innerW}
              y2={yAt(w)}
              stroke={colors.border}
              strokeWidth={1}
              strokeDasharray={i === 1 ? '4 4' : undefined}
            />
            <SvgText
              x={PAD.left - 6}
              y={yAt(w) + 4}
              textAnchor="end"
              fontSize={10}
              fill={colors.text.muted}
            >
              {w.toFixed(1)}
            </SvgText>
          </G>
        ))}

        {/* Weight line */}
        <Path
          d={pathD}
          fill="none"
          stroke={colors.primary}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data point dots */}
        {data.map((d, i) => (
          <Circle
            key={i}
            cx={xAt(i)}
            cy={yAt(d.weight)}
            r={3.5}
            fill={colors.primary}
            stroke={colors.bg.card}
            strokeWidth={1.5}
          />
        ))}

        {/* X-axis date labels */}
        {xLabelIdxs.map((i) => (
          <SvgText
            key={i}
            x={xAt(i)}
            y={totalH - 5}
            textAnchor="middle"
            fontSize={10}
            fill={colors.text.muted}
          >
            {data[i].date.slice(5)} {/* MM-DD */}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    paddingTop: spacing.md,
    paddingLeft: spacing.xs,
    paddingRight: spacing.xs,
    paddingBottom: spacing.xs,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  title: {
    ...(typography.label as object),
    color: colors.text.secondary,
    marginLeft: spacing.md,
    marginBottom: spacing.xs,
  },
});
