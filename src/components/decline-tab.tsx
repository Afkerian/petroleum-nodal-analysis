import { useMemo, useState } from "react";
import { Calculator, TrendingDown } from "lucide-react";
import { arpsDecline, type DeclineKind } from "@/lib/decline-curve";
import { fmt } from "@/lib/utils";
import { useLocalStorage } from "@/lib/use-local-storage";
import { useFluid } from "@/lib/fluid";
import { downloadCSV } from "@/lib/csv";
import { toast } from "@/lib/toast";
import { PetroleumChart, type ChartSeries } from "./petroleum-chart";
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

interface DeclineForm {
  qi: string;
  diYearly: string;
  b: string;
  qAbandon: string;
  years: string;
  kind: DeclineKind;
}

const DEFAULTS: DeclineForm = {
  qi: "1500",
  diYearly: "0.25",
  b: "0.5",
  qAbandon: "100",
  years: "20",
  kind: "hyperbolic",
};

const num = (s: string) => {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
};

export function DeclineTab() {
  const { fluid } = useFluid();
  const [form, setForm] = useLocalStorage<DeclineForm>("decline-form", DEFAULTS);
  const [result, setResult] = useState<ReturnType<typeof arpsDecline> | null>(null);

  function compute() {
    try {
      const r = arpsDecline({
        qi: num(form.qi),
        diYearly: num(form.diYearly),
        b: num(form.b),
        qAbandon: num(form.qAbandon),
        years: Math.max(1, num(form.years)),
        kind: form.kind,
      });
      setResult(r);
      toast.success(
        "Cálculo de declinación completado",
        `EUR estimada: ${fmt(r.eur, 0)} ${fluid === "gas" ? "MMscf" : "STB"}`
      );
    } catch {
      toast.error("Error al calcular declinación");
    }
  }

  const series = useMemo<ChartSeries[]>(() => {
    if (!result) return [];
    return [
      {
        name: "q(t)",
        color: "#3498DB",
        points: result.series.map((p) => ({ q: p.year, pwf: p.q })),
      },
    ];
  }, [result]);

  const cumSeries = useMemo<ChartSeries[]>(() => {
    if (!result) return [];
    return [
      {
        name: "Producción acumulada",
        color: "#16A085",
        points: result.series.map((p) => ({ q: p.year, pwf: p.cumStb })),
      },
    ];
  }, [result]);

  function exportCSV() {
    if (!result) return;
    const rows: Array<Array<string | number>> = [
      ["Año", `q (${fluid === "gas" ? "MMscfd" : "STB/d"})`, `Acumulado (${fluid === "gas" ? "MMscf" : "STB"})`],
    ];
    for (const p of result.series) {
      rows.push([p.year.toFixed(3), p.q.toFixed(2), p.cumStb.toFixed(0)]);
    }
    downloadCSV(rows, `decline-${form.kind}.csv`);
  }

  const qUnit = fluid === "gas" ? "MMscfd" : "STB/d";
  const cumUnit = fluid === "gas" ? "MMscf" : "STB";

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]">
      <Card className="anim-fade-in">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-primary" />
            Análisis de declinación (Arps)
            <Badge variant={fluid === "gas" ? "warning" : "secondary"}>
              {fluid === "gas" ? "GAS" : "OIL"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de declinación</Label>
            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as DeclineKind })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exponential">Exponencial (b = 0)</SelectItem>
                <SelectItem value="hyperbolic">Hiperbólica (0 &lt; b &lt; 1)</SelectItem>
                <SelectItem value="harmonic">Armónica (b = 1)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Field label={`q inicial qi (${qUnit})`} v={form.qi} on={(s) => setForm({ ...form, qi: s })} />
          <Field label="Tasa decl. anual Di (1/año)" v={form.diYearly} on={(s) => setForm({ ...form, diYearly: s })} />
          {form.kind === "hyperbolic" && (
            <Field label="Exponente b (0 < b < 1)" v={form.b} on={(s) => setForm({ ...form, b: s })} />
          )}
          <Field label={`q abandono (${qUnit})`} v={form.qAbandon} on={(s) => setForm({ ...form, qAbandon: s })} />
          <Field label="Horizonte (años)" v={form.years} on={(s) => setForm({ ...form, years: s })} />
          <Button className="w-full" onClick={compute}>
            <Calculator className="mr-2 h-4 w-4" />
            Calcular
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-5">
        {result && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard
              label="EUR"
              value={fmt(result.eur, 0)}
              unit={cumUnit}
              tone="success"
              hint="Reservas recuperables"
            />
            <KpiCard
              label="Vida útil"
              value={fmt(result.yearsToAbandon, 1)}
              unit="años"
              tone="default"
              hint="Hasta abandono"
            />
            <KpiCard
              label="qi"
              value={fmt(num(form.qi), 0)}
              unit={qUnit}
            />
            <KpiCard
              label="Decl. anual"
              value={`${fmt(num(form.diYearly) * 100, 1)}%`}
              unit="/año"
              tone="warning"
            />
          </div>
        )}

        <Card className="anim-slide-up">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm">Curva de producción q(t)</CardTitle>
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={!result}>
              CSV
            </Button>
          </CardHeader>
          <CardContent>
            {result ? (
              <PetroleumChart
                series={series}
                xLabel="Tiempo (años)"
                yLabel={`q (${qUnit})`}
                height={300}
              />
            ) : (
              <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-primary/30 bg-card text-sm text-muted-foreground">
                Calcula la declinación para ver la curva.
              </div>
            )}
          </CardContent>
        </Card>

        {result && (
          <Card className="anim-slide-up">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Producción acumulada</CardTitle>
            </CardHeader>
            <CardContent>
              <PetroleumChart
                series={cumSeries}
                xLabel="Tiempo (años)"
                yLabel={`Acumulado (${cumUnit})`}
                height={260}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Field({ label, v, on }: { label: string; v: string; on: (s: string) => void }) {
  return (
    <div className="grid grid-cols-2 items-center gap-2">
      <Label className="text-xs">{label}</Label>
      <Input type="number" step="any" value={v} onChange={(e) => on(e.target.value)} />
    </div>
  );
}
