import { useMemo, useState } from "react";
import { Beaker, Calculator, Plus, X } from "lucide-react";
import { gasMaterialBalance, type MBPoint } from "@/lib/material-balance";
import { fmt } from "@/lib/utils";
import { useLocalStorage } from "@/lib/use-local-storage";
import { downloadCSV } from "@/lib/csv";
import { PetroleumChart, type ChartSeries, type ChartMarker } from "./petroleum-chart";
import { KpiCard } from "./ui/kpi-card";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface MBForm {
  observations: MBPoint[];
  gasSg: string;
  tempF: string;
  pAbandonment: string;
}

const DEFAULTS: MBForm = {
  observations: [
    { p: 4500, gp: 0 },
    { p: 4200, gp: 1.2 },
    { p: 3850, gp: 2.6 },
    { p: 3450, gp: 4.1 },
    { p: 2900, gp: 6.0 },
  ],
  gasSg: "0.7",
  tempF: "200",
  pAbandonment: "500",
};

const num = (s: string) => {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
};

export function MaterialBalanceTab() {
  const [form, setForm] = useLocalStorage<MBForm>("mb-form", DEFAULTS);
  const [result, setResult] = useState<ReturnType<typeof gasMaterialBalance> | null>(null);

  function compute() {
    setResult(
      gasMaterialBalance({
        observations: form.observations,
        gasSg: num(form.gasSg),
        tempF: num(form.tempF),
        pAbandonment: num(form.pAbandonment),
      })
    );
  }

  function addObs() {
    const last = form.observations[form.observations.length - 1] ?? { p: 1000, gp: 0 };
    setForm({
      ...form,
      observations: [...form.observations, { p: last.p - 200, gp: last.gp + 1 }],
    });
  }

  function removeObs(i: number) {
    setForm({ ...form, observations: form.observations.filter((_, idx) => idx !== i) });
  }

  function updateObs(i: number, key: "p" | "gp", v: string) {
    const copy = form.observations.map((o, idx) =>
      idx === i ? { ...o, [key]: parseFloat(v) || 0 } : o
    );
    setForm({ ...form, observations: copy });
  }

  const series = useMemo<ChartSeries[]>(() => {
    if (!result) return [];
    const fit: ChartSeries = {
      name: "Ajuste lineal P/Z",
      color: "#3498DB",
      points: result.curve.map((c) => ({ q: c.gp, pwf: c.pz })),
    };
    return [fit];
  }, [result]);

  const markers = useMemo<ChartMarker[]>(() => {
    if (!result) return [];
    return form.observations.map((o, i) => {
      const pz = result.curve.find((c) => Math.abs(c.gp - o.gp) < 1e-3);
      return {
        q: o.gp,
        pwf: pz?.pz ?? 0,
        label: `#${i + 1}`,
        color: "#E74C3C",
      } as ChartMarker;
    });
  }, [result, form.observations]);

  function exportCSV() {
    if (!result) return;
    const rows: Array<Array<string | number>> = [["Gp (Bcf)", "P/Z (psi)"]];
    for (const c of result.curve) rows.push([c.gp.toFixed(3), c.pz.toFixed(2)]);
    downloadCSV(rows, "material-balance.csv");
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[400px_1fr]">
      <Card className="anim-fade-in">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Beaker className="h-4 w-4 text-primary" />
            Balance de materia (gas) — P/Z vs Gp
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">γ gas</Label>
              <Input type="number" step="any" value={form.gasSg} onChange={(e) => setForm({ ...form, gasSg: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">T (°F)</Label>
              <Input type="number" step="any" value={form.tempF} onChange={(e) => setForm({ ...form, tempF: e.target.value })} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Presión abandono (psi)</Label>
            <Input type="number" step="any" value={form.pAbandonment} onChange={(e) => setForm({ ...form, pAbandonment: e.target.value })} />
          </div>
          <div className="rounded-md border border-border/40 bg-muted/30 p-2">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Observaciones de campo</p>
              <Button size="sm" variant="ghost" onClick={addObs} aria-label="Agregar punto">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-1 text-[10px] uppercase">
              <span>P (psi)</span><span>Gp (Bcf)</span><span></span>
            </div>
            <div className="space-y-1">
              {form.observations.map((o, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-1">
                  <Input className="h-8" type="number" step="any" value={o.p} onChange={(e) => updateObs(i, "p", e.target.value)} />
                  <Input className="h-8" type="number" step="any" value={o.gp} onChange={(e) => updateObs(i, "gp", e.target.value)} />
                  <Button size="sm" variant="ghost" onClick={() => removeObs(i)} aria-label="Quitar">
                    <X className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <Button className="w-full" onClick={compute}>
            <Calculator className="mr-2 h-4 w-4" />
            Calcular OOIP / OGIP
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-5">
        {result && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="OGIP" value={fmt(result.oogipBcf, 2)} unit="Bcf" tone="success" hint="Gas in-place" />
            <KpiCard label="Recuperable" value={fmt(result.recoverableBcf, 2)} unit="Bcf" tone="default" />
            <KpiCard label="Factor de recobro" value={`${fmt(result.recoveryFactor * 100, 1)}%`} tone="warning" />
            <KpiCard label="R²" value={fmt(result.fitR2, 3)} hint="Calidad del ajuste" />
          </div>
        )}

        <Card className="anim-slide-up">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm">P/Z vs Gp (acumulado)</CardTitle>
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={!result}>CSV</Button>
          </CardHeader>
          <CardContent>
            {result ? (
              <PetroleumChart
                series={series}
                markers={markers}
                xLabel="Gp (Bcf)"
                yLabel="P/Z (psi)"
                height={360}
              />
            ) : (
              <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-primary/30 bg-card text-sm text-muted-foreground">
                Ingresa observaciones P-Gp y calcula.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
