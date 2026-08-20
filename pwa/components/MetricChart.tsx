import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText, G } from 'react-native-svg';
import { colors, spacing, typography, radius, shadows } from '../theme';

export interface MetricPoint {
  date: string;
  value: number;
}

interface Props {
  data: MetricPoint[];
  label: string;
  /** Outer width including card padding. Defaults to screen width minus 32px. */
  width?: number;
}

const PAD = { left: 44, right: 12, top: 14, bottom: 28 };
const CHART_H = 130;

export function MetricChart({ data, label, width: outerWidth }: Props) {
  if (data.length < 2) return null;

  const totalW = outerWidth ?? Dimensions.get('window').width - 32;
  const innerW = totalW - PAD.left - PAD.right;
  const totalH = CHART_H + PAD.top + PAD.bottom;

  const values = data.map((d) => d.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const minV = rawMin - (rawMax - rawMin) * 0.15 - 0.1;
  const maxV = rawMax + (rawMax - rawMin) * 0.15 + 0.1;
  const range = maxV - minV;

  const xAt = (i: number) => PAD.left + (i / (data.length - 1)) * innerW;
  const yAt = (v: number) => PAD.top + (1 - (v - minV) / range) * CHART_H;

  const pathD = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(d.value).toFixed(1)}`).join(' ');

  const yTicks = [rawMin, (rawMin + rawMax) / 2, rawMax];

  const xLabelIdxs: number[] = [];
  const step = Math.max(1, Math.floor((data.length - 1) / 3));
  for (let i = 0; i < data.length; i += step) xLabelIdxs.push(i);
  if (xLabelIdxs[xLabelIdxs.length - 1] !== data.length - 1) xLabelIdxs.push(data.length - 1);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{label} Trend</Text>
      <Svg width={totalW} height={totalH}>
        {yTicks.map((v, i) => (
          <G key={i}>
            <Line
              x1={PAD.left}
              y1={yAt(v)}
              x2={PAD.left + innerW}
              y2={yAt(v)}
              stroke={colors.border}
              strokeWidth={1}
              strokeDasharray={i === 1 ? '4 4' : undefined}
            />
            <SvgText
              x={PAD.left - 6}
              y={yAt(v) + 4}
              textAnchor="end"
              fontSize={10}
              fill={colors.text.muted}
            >
              {v.toFixed(1)}
            </SvgText>
          </G>
        ))}

        <Path
          d={pathD}
          fill="none"
          stroke={colors.primary}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {data.map((d, i) => (
          <Circle
            key={i}
            cx={xAt(i)}
            cy={yAt(d.value)}
            r={3.5}
            fill={colors.primary}
            stroke={colors.bg.card}
            strokeWidth={1.5}
          />
        ))}

        {xLabelIdxs.map((i) => (
          <SvgText
            key={i}
            x={xAt(i)}
            y={totalH - 5}
            textAnchor="middle"
            fontSize={10}
            fill={colors.text.muted}
          >
            {data[i].date.slice(5)}
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
