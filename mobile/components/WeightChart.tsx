import React from 'react';
import { useTranslation } from 'react-i18next';
import { MetricChart } from './MetricChart';
import type { WeightDataPoint } from '../api/healthLog';

interface Props {
  data: WeightDataPoint[];
  width?: number;
}

export function WeightChart({ data, width }: Props) {
  const { t } = useTranslation();
  return (
    <MetricChart
      data={data.map((d) => ({ date: d.date, value: d.weight }))}
      label={t('healthLog.weight')}
      width={width}
    />
  );
}
