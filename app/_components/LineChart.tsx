"use client";

import { useMemo, useState } from "react";

type Datum = { label: string; value: number };

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function LineChart({
  data,
  valueFormatter,
}: {
  data: Datum[];
  valueFormatter: (v: number) => string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const {
    path,
    points,
    min,
    max,
    viewBoxWidth,
    viewBoxHeight,
    padding,
  } = useMemo(() => {
    const padding = 40;
    const viewBoxWidth = 1000;
    const viewBoxHeight = 260;

    const values = data.map((d) => d.value);
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 0;
    const span = Math.max(1e-9, max - min);

    const xStep = data.length > 1 ? (viewBoxWidth - padding * 2) / (data.length - 1) : 0;

    const pts = data.map((d, idx) => {
      const x = padding + idx * xStep;
      const y = padding + (1 - (d.value - min) / span) * (viewBoxHeight - padding * 2);
      return { x, y };
    });

    const path = pts
      .map((p, i) => {
        const cmd = i === 0 ? "M" : "L";
        return `${cmd}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
      })
      .join(" ");

    return { path, points: pts, min, max, viewBoxWidth, viewBoxHeight, padding };
  }, [data]);

  const hovered = hoveredIndex === null ? null : data[hoveredIndex];
  const hoveredPoint = hoveredIndex === null ? null : points[hoveredIndex];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        className="h-64 w-full"
        role="img"
        aria-label="MRR line chart"
      >
        <rect x="0" y="0" width={viewBoxWidth} height={viewBoxHeight} fill="white" rx={12} />

        {/* Grid */}
        {Array.from({ length: 5 }).map((_, i) => {
          const y = padding + (i * (viewBoxHeight - padding * 2)) / 4;
          return <line key={i} x1={padding} x2={viewBoxWidth - padding} y1={y} y2={y} stroke="#e2e8f0" />;
        })}

        {/* Line */}
        <path d={path} fill="none" stroke="#0f172a" strokeWidth={3} />

        {/* Points */}
        {points.map((p, idx) => (
          <circle
            key={idx}
            cx={p.x}
            cy={p.y}
            r={6}
            fill="#ffffff"
            stroke="#0f172a"
            strokeWidth={2}
            onMouseEnter={() => setHoveredIndex(idx)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}

        {/* Axis labels (min/max) */}
        <text x={padding} y={padding - 12} fontSize={12} fill="#64748b">
          {valueFormatter(max)}
        </text>
        <text x={padding} y={viewBoxHeight - padding + 24} fontSize={12} fill="#64748b">
          {valueFormatter(min)}
        </text>

        {/* X labels: first/middle/last */}
        {data.length >= 1 ? (
          <text x={padding} y={viewBoxHeight - 12} fontSize={12} fill="#64748b">
            {data[0].label}
          </text>
        ) : null}
        {data.length >= 3 ? (
          <text
            x={padding + ((data.length - 1) * (viewBoxWidth - padding * 2)) / (data.length - 1) / 2}
            y={viewBoxHeight - 12}
            fontSize={12}
            fill="#64748b"
            textAnchor="middle"
          >
            {data[Math.floor((data.length - 1) / 2)]?.label}
          </text>
        ) : null}
        {data.length >= 2 ? (
          <text x={viewBoxWidth - padding} y={viewBoxHeight - 12} fontSize={12} fill="#64748b" textAnchor="end">
            {data[data.length - 1].label}
          </text>
        ) : null}

        {/* Hover marker */}
        {hoveredPoint ? (
          <line
            x1={hoveredPoint.x}
            x2={hoveredPoint.x}
            y1={padding}
            y2={viewBoxHeight - padding}
            stroke="#94a3b8"
            strokeDasharray="4 6"
          />
        ) : null}
      </svg>

      {hovered && hoveredPoint ? (
        <div
          className="pointer-events-none absolute rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow"
          style={{
            left: clamp((hoveredPoint.x / viewBoxWidth) * 100, 5, 85) + "%",
            top: 16,
          }}
        >
          <div className="font-medium text-slate-900">{hovered.label}</div>
          <div className="mt-0.5 text-slate-600">{valueFormatter(hovered.value)}</div>
        </div>
      ) : null}
    </div>
  );
}
