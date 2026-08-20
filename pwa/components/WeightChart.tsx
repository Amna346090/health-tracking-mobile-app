import React from 'react';
import { MetricChart } from './MetricChart';
import type { WeightDataPoint } from '../api/healthLog';

interface Props {
  data: WeightDataPoint[];
  width?: number;
}

export function WeightChart({ data, width }: Props) {
  return (
    <MetricChart
      data={data.map((d) => ({ date: d.date, value: d.weight }))}
      label="Weight"
      width={width}
    />
  );
}
