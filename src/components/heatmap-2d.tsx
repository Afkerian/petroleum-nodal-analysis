import { useMemo } from "react";
import { colorScale } from "@/lib/palettes";
import { fmt } from "@/lib/utils";

interface Cell {
  a: number;
  b: number;
  value: number;
}

interface Props {
  cells: Cell[];
  labelA: string;
  labelB: string;
  unitValue?: string;
  scale?: "viridis" | "inferno";
  height?: number;
}

/**
 * Heatmap simple en SVG. Cada celda es un rect de tamaño uniforme; color
 * mapeado por colorScale (Viridis/Inferno). Eje A horizontal, B vertical.
 */
export function Heatmap2D({
  cells,
  labelA,
  labelB,
  unitValue,
  scale = "viridis",
  height = 360,
}: Props) {
  const { aValues, bValues, lookup, vMin, vMax } = useMemo(() => {
    const aSet = Array.from(new Set(cells.map((c) => +c.a.toFixed(6)))).sort((x, y) => x - y);
    const bSet = Array.from(new Set(cells.map((c) => +c.b.toFixed(6)))).sort((x, y) => x - y);
    const map = new Map<string, number>();
    let mn = Infinity;
    let mx = -Infinity;
    for (const c of cells) {
      const v = c.value;
      const key = `${(+c.a.toFixed(6))}|${(+c.b.toFixed(6))}`;
      map.set(key, v);
      if (Number.isFinite(v)) {
        mn = Math.min(mn, v);
        mx = Math.max(mx, v);
      }
    }
    return { aValues: aSet, bValues: bSet, lookup: map, vMin: mn, vMax: mx };
  }, [cells]);

  if (aValues.length === 0 || bValues.length === 0) {
    return (
      <div
        className="grid place-items-center rounded-lg border border-dashed border-primary/30 text-xs text-muted-foreground"
        style={{ height }}
      >
        Sin datos.
      </div>
    );
  }

  const padL = 60;
  const padR = 24;
  const padT = 20;
  const padB = 50;
  const innerW = 600;
  const innerH = height - padT - padB;
  const cellW = innerW / aValues.length;
  const cellH = innerH / bValues.length;
  const range = Math.max(1e-9, vMax - vMin);

  return (
    <div className="rounded-lg border border-border/50 bg-card p-3">
      <svg
        viewBox={`0 0 ${padL + innerW + padR} ${padT + innerH + padB}`}
        width="100%"
        height={height}
        role="img"
        aria-label={`Heatmap ${labelA} vs ${labelB}`}
      >
        {/* Grid de celdas */}
        {bValues.map((b, j) =>
          aValues.map((a, i) => {
            const v = lookup.get(`${(+a.toFixed(6))}|${(+b.toFixed(6))}`) ?? NaN;
            const t = Number.isFinite(v) ? (v - vMin) / range : 0;
            const fill = Number.isFinite(v) ? colorScale(t, scale) : "hsl(var(--muted))";
            const x = padL + i * cellW;
            const y = padT + (bValues.length - 1 - j) * cellH;
            return (
              <g key={`${i}-${j}`}>
                <rect x={x} y={y} width={cellW} height={cellH} fill={fill} stroke="white" strokeWidth={0.5}>
                  <title>{`${labelA} = ${fmt(a, 2)} · ${labelB} = ${fmt(b, 2)} · ${fmt(v, 2)} ${unitValue ?? ""}`}</title>
                </rect>
                {Number.isFinite(v) && cellW > 50 && (
                  <text
                    x={x + cellW / 2}
                    y={y + cellH / 2 + 3}
                    textAnchor="middle"
                    fontSize={9}
                    fill={t > 0.55 ? "white" : "black"}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {fmt(v, 0)}
                  </text>
                )}
              </g>
            );
          })
        )}
        {/* Eje X (param A) */}
        {aValues.map((a, i) => (
          <text
            key={`xt${i}`}
            x={padL + i * cellW + cellW / 2}
            y={padT + innerH + 14}
            textAnchor="middle"
            fontSize={9}
            fill="hsl(var(--foreground))"
          >
            {fmt(a, 1)}
          </text>
        ))}
        <text
          x={padL + innerW / 2}
          y={padT + innerH + 36}
          textAnchor="middle"
          fontSize={11}
          fontWeight="bold"
          fill="hsl(var(--primary))"
        >
          {labelA}
        </text>
        {/* Eje Y (param B) */}
        {bValues.map((b, j) => (
          <text
            key={`yt${j}`}
            x={padL - 4}
            y={padT + (bValues.length - 1 - j) * cellH + cellH / 2 + 3}
            textAnchor="end"
            fontSize={9}
            fill="hsl(var(--foreground))"
          >
            {fmt(b, 1)}
          </text>
        ))}
        <text
          x={20}
          y={padT + innerH / 2}
          textAnchor="middle"
          fontSize={11}
          fontWeight="bold"
          fill="hsl(var(--primary))"
          transform={`rotate(-90 20 ${padT + innerH / 2})`}
        >
          {labelB}
        </text>
      </svg>
      <div className="mt-2 flex items-center justify-between gap-3 text-[10px]">
        <span className="font-mono text-muted-foreground">
          {fmt(vMin, 1)} {unitValue}
        </span>
        <div className="h-2 flex-1 rounded-full bg-gradient-to-r"
          style={{
            background: `linear-gradient(to right, ${colorScale(0, scale)}, ${colorScale(0.25, scale)}, ${colorScale(0.5, scale)}, ${colorScale(0.75, scale)}, ${colorScale(1, scale)})`,
          }}
        />
        <span className="font-mono text-muted-foreground">
          {fmt(vMax, 1)} {unitValue}
        </span>
      </div>
    </div>
  );
}
