import { MetricChart } from './MetricChart';

export interface WeightPoint {
  date: string;
  weight: number;
}

interface Props {
  data: WeightPoint[];
  width?: number;
  height?: number;
}

export function WeightChart({ data, width, height }: Props) {
  return (
    <MetricChart
      data={data.map((d) => ({ date: d.date, value: d.weight }))}
      label="Weight"
      unit="kg"
      width={width}
      height={height}
    />
  );
}
