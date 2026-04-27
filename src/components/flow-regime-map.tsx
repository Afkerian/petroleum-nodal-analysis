import {
  CartesianGrid,
  Legend,
  ReferenceArea,
  ReferenceDot,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Mapa simplificado de régimen de flujo (estilo Duns-Ros) en plano VSG vs VSL.
 * Las regiones son aproximaciones pedagógicas — no sustituyen la implementación
 * formal con números adimensionales.
 *
 *   • Bubble  : VSG bajo, VSL alto
 *   • Slug    : VSG y VSL intermedios
 *   • Annular : VSG alto, VSL bajo
 *   • Mist    : VSG muy alto
 */
interface Props {
  vsl?: number;
  vsg?: number;
}

export function FlowRegimeMap({ vsl, vsg }: Props) {
  const point =
    vsl !== undefined && vsg !== undefined && Number.isFinite(vsl) && Number.isFinite(vsg)
      ? [{ vsg: Math.max(0.01, vsg), vsl: Math.max(0.01, vsl) }]
      : [];

  return (
    <div className="h-[360px] w-full rounded-lg border border-border/50 bg-card p-3">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 24, bottom: 30, left: 10 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" />
          <XAxis
            type="number"
            dataKey="vsg"
            name="VSG"
            scale="log"
            domain={[0.01, 100]}
            ticks={[0.01, 0.1, 1, 10, 100]}
            label={{
              value: "VSG (ft/s) — log",
              position: "insideBottom",
              offset: -10,
              fill: "hsl(var(--primary))",
            }}
            stroke="hsl(var(--primary))"
            tick={{ fontSize: 10 }}
          />
          <YAxis
            type="number"
            dataKey="vsl"
            name="VSL"
            scale="log"
            domain={[0.01, 100]}
            ticks={[0.01, 0.1, 1, 10, 100]}
            label={{
              value: "VSL (ft/s) — log",
              angle: -90,
              position: "insideLeft",
              fill: "hsl(var(--primary))",
            }}
            stroke="hsl(var(--primary))"
            tick={{ fontSize: 10 }}
          />
          {/* Bubble (VSG bajo, VSL alto) */}
          <ReferenceArea
            x1={0.01}
            x2={1}
            y1={1}
            y2={100}
            fill="#3498DB"
            fillOpacity={0.12}
            label={{ value: "Bubble", position: "center", fill: "#1F5F8B", fontSize: 11, fontWeight: 600 }}
          />
          {/* Slug (centro) */}
          <ReferenceArea
            x1={1}
            x2={20}
            y1={0.1}
            y2={10}
            fill="#9B59B6"
            fillOpacity={0.12}
            label={{ value: "Slug", position: "center", fill: "#5E2D7A", fontSize: 11, fontWeight: 600 }}
          />
          {/* Annular (VSG alto, VSL medio-alto) */}
          <ReferenceArea
            x1={20}
            x2={100}
            y1={0.1}
            y2={10}
            fill="#16A085"
            fillOpacity={0.12}
            label={{ value: "Annular", position: "center", fill: "#0F6657", fontSize: 11, fontWeight: 600 }}
          />
          {/* Mist (VSG muy alto, VSL bajo) */}
          <ReferenceArea
            x1={5}
            x2={100}
            y1={0.01}
            y2={0.1}
            fill="#E67E22"
            fillOpacity={0.15}
            label={{ value: "Mist", position: "center", fill: "#A0510C", fontSize: 11, fontWeight: 600 }}
          />
          <Tooltip
            formatter={(v: number) => v.toFixed(3)}
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 6,
              fontSize: 11,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Scatter
            name="Punto operativo"
            data={point}
            fill="#E74C3C"
            shape="star"
          />
          {point.length > 0 && (
            <ReferenceDot
              x={point[0].vsg}
              y={point[0].vsl}
              r={6}
              fill="#E74C3C"
              stroke="white"
              strokeWidth={2}
            />
          )}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
