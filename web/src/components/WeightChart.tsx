import { useRef, useState } from 'react';

export interface WeightPoint {
  date: string;
  weight: number;
}

interface Props {
  data: WeightPoint[];
  width?: number;
  height?: number;
}

const PAD = { left: 46, right: 16, top: 16, bottom: 30 };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function WeightChart({ data, width = 620, height = 200 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (data.length < 2) return null;

  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;

  const weights = data.map((d) => d.weight);
  const rawMin = Math.min(...weights);
  const rawMax = Math.max(...weights);
  const span = rawMax - rawMin || 1;
  const minW = rawMin - span * 0.15;
  const maxW = rawMax + span * 0.15;
  const range = maxW - minW;

  const xAt = (i: number) => PAD.left + (i / (data.length - 1)) * innerW;
  const yAt = (w: number) => PAD.top + (1 - (w - minW) / range) * innerH;

  const pathD = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(d.weight).toFixed(1)}`).join(' ');

  const yTicks = [rawMin, (rawMin + rawMax) / 2, rawMax];

  const xLabelStep = Math.max(1, Math.floor((data.length - 1) / 4));
  const xLabelIdxs: number[] = [];
  for (let i = 0; i < data.length; i += xLabelStep) xLabelIdxs.push(i);
  if (xLabelIdxs[xLabelIdxs.length - 1] !== data.length - 1) xLabelIdxs.push(data.length - 1);

  function handleMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < data.length; i++) {
      const dist = Math.abs(xAt(i) - x);
      if (dist < nearestDist) { nearestDist = dist; nearest = i; }
    }
    setHoverIdx(nearest);
  }

  const hovered = hoverIdx !== null ? data[hoverIdx] : null;
  const first = data[0].weight;
  const last = data[data.length - 1].weight;
  const delta = Math.round((last - first) * 10) / 10;
  const deltaColor = delta < 0 ? 'var(--color-success)' : delta > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)';

  return (
    <div className="card weight-chart-card">
      <div className="weight-chart-header">
        <span className="section-title" style={{ margin: 0 }}>Weight Trend</span>
        <span className="weight-chart-delta" style={{ color: deltaColor }}>
          {delta > 0 ? '+' : ''}{delta} kg over {data.length} logs
        </span>
      </div>

      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverIdx(null)}
        style={{ display: 'block', cursor: 'crosshair' }}
      >
        {yTicks.map((w, i) => (
          <g key={i}>
            <line
              x1={PAD.left} y1={yAt(w)} x2={PAD.left + innerW} y2={yAt(w)}
              stroke="var(--color-border)" strokeWidth={1}
            />
            <text x={PAD.left - 8} y={yAt(w) + 4} textAnchor="end" fontSize={10.5} fill="var(--color-text-muted)">
              {w.toFixed(1)}
            </text>
          </g>
        ))}

        {hoverIdx !== null && (
          <line
            x1={xAt(hoverIdx)} y1={PAD.top} x2={xAt(hoverIdx)} y2={PAD.top + innerH}
            stroke="var(--color-border)" strokeWidth={1}
          />
        )}

        <path d={pathD} fill="none" stroke="var(--color-primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {data.map((d, i) => (
          <circle
            key={i}
            cx={xAt(i)} cy={yAt(d.weight)}
            r={hoverIdx === i ? 5 : 3.5}
            fill="var(--color-primary)"
            stroke="var(--color-bg-card)"
            strokeWidth={2}
          />
        ))}

        {xLabelIdxs.map((i) => (
          <text key={i} x={xAt(i)} y={height - 8} textAnchor="middle" fontSize={10.5} fill="var(--color-text-muted)">
            {formatDate(data[i].date)}
          </text>
        ))}
      </svg>

      {hovered && (
        <div className="weight-chart-tooltip">
          <strong>{hovered.weight} kg</strong>
          <span>{formatDate(hovered.date)}</span>
        </div>
      )}
    </div>
  );
}
