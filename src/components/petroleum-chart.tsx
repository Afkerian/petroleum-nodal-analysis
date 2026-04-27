import { useMemo } from "react";
import {
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmt } from "@/lib/utils";

export interface ChartSeries {
  name: string;
  color: string;
  points: { q: number; pwf: number }[];
  dashed?: boolean;
}

export interface ChartMarker {
  q: number;
  pwf: number;
  label: string;
  color?: string;
}

export interface ChartReferenceLine {
  axis: "x" | "y";
  value: number;
  label: string;
  color?: string;
}

interface PetroleumChartProps {
  series: ChartSeries[];
  title?: string;
  xLabel?: string;
  yLabel?: string;
  markers?: ChartMarker[];
  referenceLines?: ChartReferenceLine[];
  scale?: "linear" | "log";
  showBrush?: boolean;
  height?: number;
}

function buildData(series: ChartSeries[]) {
  const map = new Map<number, Record<string, number>>();
  for (const s of series) {
    for (const p of s.points) {
      const qKey = +p.q.toFixed(4);
      const row = map.get(qKey) ?? { q: qKey };
      row[s.name] = p.pwf;
      map.set(qKey, row);
    }
  }
  return Array.from(map.values()).sort((a, b) => (a.q as number) - (b.q as number));
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-border bg-popover/95 px-3 py-2 text-xs shadow-md backdrop-blur">
      <p className="font-semibold text-popover-foreground">
        Q = {fmt(Number(label), 2)}
      </p>
      <div className="mt-1 space-y-0.5">
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: p.color }}
              aria-hidden
            />
            <span className="text-muted-foreground">{p.name}:</span>
            <span className="font-medium text-popover-foreground">
              {fmt(Number(p.value), 2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PetroleumChart({
  series,
  title,
  xLabel = "Caudal Q [STB/d]",
  yLabel = "Pwf [psi]",
  markers,
  referenceLines,
  scale = "linear",
  showBrush = false,
  height = 360,
}: PetroleumChartProps) {
  const data = useMemo(() => buildData(series), [series]);
  return (
    <div
      className="w-full rounded-lg border border-border/50 bg-card p-3"
      style={{ height }}
      role="img"
      aria-label={title ?? "Gráfico petrolero"}
    >
      {title && <h3 className="mb-2 text-sm font-semibold text-primary">{title}</h3>}
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 24, bottom: 30, left: 10 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="q"
            type="number"
            scale={scale}
            domain={scale === "log" ? ["auto", "auto"] : ["auto", "auto"]}
            allowDataOverflow
            label={{
              value: xLabel,
              position: "insideBottom",
              offset: -10,
              fill: "hsl(var(--primary))",
            }}
            stroke="hsl(var(--primary))"
            tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
          />
          <YAxis
            scale={scale}
            domain={scale === "log" ? [1, "auto"] : ["auto", "auto"]}
            allowDataOverflow
            label={{
              value: yLabel,
              angle: -90,
              position: "insideLeft",
              fill: "hsl(var(--primary))",
            }}
            stroke="hsl(var(--primary))"
            tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {referenceLines?.map((rl, i) => (
            <ReferenceLine
              key={`ref-${i}`}
              x={rl.axis === "x" ? rl.value : undefined}
              y={rl.axis === "y" ? rl.value : undefined}
              stroke={rl.color ?? "hsl(var(--secondary))"}
              strokeDasharray="4 2"
              label={{
                value: rl.label,
                position: rl.axis === "x" ? "top" : "right",
                fontSize: 10,
                fill: rl.color ?? "hsl(var(--secondary))",
              }}
            />
          ))}
          {series.map((s) => (
            <Line
              key={s.name}
              type="monotone"
              dataKey={s.name}
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dashed ? "5 4" : undefined}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
          {markers?.map((m, i) => (
            <ReferenceDot
              key={`mk-${i}`}
              x={m.q}
              y={m.pwf}
              r={6}
              fill={m.color ?? "hsl(var(--destructive))"}
              stroke="white"
              strokeWidth={2}
              label={{
                value: m.label,
                position: "top",
                fontSize: 11,
                fill: m.color ?? "hsl(var(--destructive))",
                fontWeight: 600,
              }}
            />
          ))}
          {showBrush && (
            <Brush
              dataKey="q"
              height={22}
              stroke="hsl(var(--primary))"
              travellerWidth={8}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
