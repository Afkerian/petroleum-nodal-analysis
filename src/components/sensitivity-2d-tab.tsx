import { useState } from "react";
import { Calculator, Grid3x3 } from "lucide-react";
import { sweep2D, type Sens2DCell } from "@/lib/sensitivity-2d";
import { IPR } from "@/lib/ipr-models";
import type { VLPInput } from "@/lib/vlp-models";
import { useFluid } from "@/lib/fluid";
import { useLocalStorage } from "@/lib/use-local-storage";
import { Heatmap2D } from "./heatmap-2d";
import { KpiCard } from "./ui/kpi-card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

type Param = "pWh" | "tubingIdIn" | "lengthFt" | "gor" | "bsw" | "tempBhF";

const LABELS: Record<Param, string> = {
  pWh: "P cabeza (psi)",
  tubingIdIn: "Tubing ID (in)",
  lengthFt: "Profundidad (ft)",
  gor: "GOR (scf/STB)",
  bsw: "BSW (%)",
  tempBhF: "T fondo (°F)",
};

interface Form {
  paramA: Param;
  paramB: Param;
  fromA: string; toA: string; stepsA: string;
  fromB: string; toB: string; stepsB: string;
  // base
  depth: string; tid: string; twh: string; tbh: string; pwh: string;
  api: string; gsg: string; wsg: string; bw: string; gor: string; bsw: string;
  pres: string; qmax: string;
}

const DEFAULTS: Form = {
  paramA: "pWh", paramB: "gor",
  fromA: "100", toA: "400", stepsA: "5",
  fromB: "300", toB: "1500", stepsB: "5",
  depth: "8000", tid: "2.441", twh: "100", tbh: "200", pwh: "150",
  api: "30", gsg: "0.75", wsg: "1.02", bw: "1.0", gor: "800", bsw: "10",
  pres: "3000", qmax: "6774",
};

const num = (s: string) => {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
};

export function Sensitivity2DTab() {
  const { fluid } = useFluid();
  const [form, setForm] = useLocalStorage<Form>("sens2d-form", DEFAULTS);
  const [cells, setCells] = useState<Sens2DCell[]>([]);
  const [running, setRunning] = useState(false);

  function run() {
    setRunning(true);
    try {
      const ipr = IPR.vogel(num(form.qmax), num(form.pres), 60).points;
      const base: Omit<VLPInput, "qLiqBpd"> = {
        lengthFt: num(form.depth),
        tubingIdIn: num(form.tid),
        pWh: num(form.pwh),
        tempWhF: num(form.twh),
        tempBhF: num(form.tbh),
        gor: num(form.gor),
        bsw: num(form.bsw),
        api: num(form.api),
        gasSg: num(form.gsg),
        waterSg: num(form.wsg),
        bw: num(form.bw),
      };
      const r = sweep2D({
        baseVLP: base,
        paramA: form.paramA as keyof VLPInput,
        paramB: form.paramB as keyof VLPInput,
        rangeA: [num(form.fromA), num(form.toA)],
        rangeB: [num(form.fromB), num(form.toB)],
        stepsA: Math.max(2, Math.min(10, num(form.stepsA))),
        stepsB: Math.max(2, Math.min(10, num(form.stepsB))),
        ipr,
        qMax: num(form.qmax),
      });
      setCells(r);
    } finally {
      setRunning(false);
    }
  }

  // Estadísticas del barrido
  const stats = (() => {
    if (cells.length === 0) return null;
    const values = cells.map((c) => c.qOp).filter((v) => Number.isFinite(v) && v > 0);
    if (values.length === 0) return null;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const best = cells.reduce((b, c) => (c.qOp > b.qOp ? c : b), cells[0]);
    return { mean, median, std, max, min, best };
  })();

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]">
      <Card className="anim-fade-in">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Grid3x3 className="h-4 w-4 text-primary" />
            Sensibilidad 2D
            <Badge variant="secondary">{fluid.toUpperCase()}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="rounded-md border border-primary/20 bg-primary/5 p-2 text-[11px]">
            Barre dos parámetros del modelo VLP simultáneamente y visualiza el caudal de operación
            como heatmap. Útil para identificar interacciones y zonas óptimas.
          </p>

          <div className="space-y-2 rounded-md border border-border/40 bg-muted/30 p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Parámetro A (eje X)</p>
            <Select value={form.paramA} onValueChange={(v) => setForm({ ...form, paramA: v as Param })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(LABELS) as Param[]).map((k) => (
                  <SelectItem key={k} value={k}>{LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-3 gap-1">
              <FieldXs label="Desde" v={form.fromA} on={(s) => setForm({ ...form, fromA: s })} />
              <FieldXs label="Hasta" v={form.toA} on={(s) => setForm({ ...form, toA: s })} />
              <FieldXs label="Pasos" v={form.stepsA} on={(s) => setForm({ ...form, stepsA: s })} />
            </div>
          </div>

          <div className="space-y-2 rounded-md border border-border/40 bg-muted/30 p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Parámetro B (eje Y)</p>
            <Select value={form.paramB} onValueChange={(v) => setForm({ ...form, paramB: v as Param })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(LABELS) as Param[]).map((k) => (
                  <SelectItem key={k} value={k}>{LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-3 gap-1">
              <FieldXs label="Desde" v={form.fromB} on={(s) => setForm({ ...form, fromB: s })} />
              <FieldXs label="Hasta" v={form.toB} on={(s) => setForm({ ...form, toB: s })} />
              <FieldXs label="Pasos" v={form.stepsB} on={(s) => setForm({ ...form, stepsB: s })} />
            </div>
          </div>

          <Button className="w-full" onClick={run} disabled={running}>
            <Calculator className="mr-2 h-4 w-4" />
            {running ? "Calculando…" : "Ejecutar barrido 2D"}
          </Button>
          <p className="text-[10px] text-muted-foreground">
            stepsA × stepsB simulaciones. Máx 10×10 = 100 escenarios.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-5">
        {stats && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <KpiCard label="q* máximo" value={Math.round(stats.max).toLocaleString()} unit="STB/d" tone="success" />
            <KpiCard label="q* mínimo" value={Math.round(stats.min).toLocaleString()} unit="STB/d" tone="warning" />
            <KpiCard label="q* media" value={Math.round(stats.mean).toLocaleString()} unit="STB/d" />
            <KpiCard label="q* mediana" value={Math.round(stats.median).toLocaleString()} unit="STB/d" />
            <KpiCard
              label="σ (std dev)"
              value={Math.round(stats.std).toLocaleString()}
              unit="STB/d"
              hint={`CV = ${((stats.std / stats.mean) * 100).toFixed(1)}%`}
            />
          </div>
        )}

        <Card className="anim-slide-up">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              Heatmap q_op — {LABELS[form.paramA]} × {LABELS[form.paramB]}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cells.length > 0 ? (
              <Heatmap2D
                cells={cells.map((c) => ({ a: c.a, b: c.b, value: c.qOp }))}
                labelA={LABELS[form.paramA]}
                labelB={LABELS[form.paramB]}
                unitValue="STB/d"
                scale="viridis"
                height={420}
              />
            ) : (
              <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-primary/30 text-sm text-muted-foreground">
                Ejecuta el barrido 2D para ver el heatmap.
              </div>
            )}
          </CardContent>
        </Card>

        {stats?.best && (
          <Card className="anim-slide-up">
            <CardContent className="grid grid-cols-3 gap-3 pt-4">
              <KpiCard label="Mejor combinación A" value={stats.best.a.toFixed(2)} hint={LABELS[form.paramA]} tone="success" />
              <KpiCard label="Mejor combinación B" value={stats.best.b.toFixed(2)} hint={LABELS[form.paramB]} tone="success" />
              <KpiCard label="q* en óptimo" value={Math.round(stats.best.qOp).toLocaleString()} unit="STB/d" tone="success" />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function FieldXs({ label, v, on }: { label: string; v: string; on: (s: string) => void }) {
  return (
    <div>
      <Label className="text-[10px]">{label}</Label>
      <Input className="h-8" type="number" step="any" value={v} onChange={(e) => on(e.target.value)} />
    </div>
  );
}
