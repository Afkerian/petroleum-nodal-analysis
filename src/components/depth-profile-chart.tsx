import {
  CartesianGrid,
  Label,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Perfil de presión vs profundidad — eje Y profundidad (descendente desde
 * la cabeza), eje X presión. Aproximación lineal usando el gradiente
 * convergido de la última iteración VLP.
 */
interface Props {
  pWh: number;
  pwf: number;
  depth: number;
  pBubble?: number;
  segments?: number;
}

export function DepthProfileChart({ pWh, pwf, depth, pBubble, segments = 40 }: Props) {
  const grad = depth > 0 ? (pwf - pWh) / depth : 0;
  const data = Array.from({ length: segments + 1 }, (_, i) => {
    const z = (depth * i) / segments;
    return { depth: z, pressure: pWh + grad * z };
  });

  return (
    <div className="h-[360px] w-full rounded-lg border border-border/50 bg-card p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 30, bottom: 30, left: 30 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" />
          <XAxis
            type="number"
            dataKey="pressure"
            domain={["dataMin - 100", "dataMax + 100"]}
            stroke="hsl(var(--primary))"
            tick={{ fontSize: 11 }}
            orientation="top"
          >
            <Label
              value="Presión (psi)"
              position="insideTop"
              offset={-2}
              fill="hsl(var(--primary))"
            />
          </XAxis>
          <YAxis
            type="number"
            dataKey="depth"
            reversed={false}
            domain={[0, depth]}
            stroke="hsl(var(--primary))"
            tick={{ fontSize: 11 }}
            allowDataOverflow={false}
            interval="preserveStartEnd"
          >
            <Label
              value="Profundidad (ft)"
              angle={-90}
              position="insideLeft"
              fill="hsl(var(--primary))"
            />
          </YAxis>
          <Tooltip
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 6,
              fontSize: 11,
            }}
            formatter={(v: number) => v.toFixed(1)}
            labelFormatter={(z: number) => `Prof = ${z.toFixed(0)} ft`}
          />
          {pBubble !== undefined && pBubble > 0 && (
            <ReferenceLine
              x={pBubble}
              stroke="#8A56AC"
              strokeDasharray="4 2"
              label={{ value: "Pb", position: "top", fontSize: 10, fill: "#8A56AC" }}
            />
          )}
          <Line
            type="monotone"
            dataKey="pressure"
            stroke="#3498DB"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-1 text-center text-[10px] text-muted-foreground">
        Aproximación lineal con el gradiente convergido. P_wh = {pWh.toFixed(0)} psi · P_wf ={" "}
        {pwf.toFixed(0)} psi · Δ = {(pwf - pWh).toFixed(0)} psi sobre {depth.toFixed(0)} ft.
      </p>
    </div>
  );
}
