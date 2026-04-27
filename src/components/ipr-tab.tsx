import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calculator,
  Download,
  Droplet,
  Layers,
  RefreshCcw,
  TrendingUp,
  Wind,
} from "lucide-react";
import { IPR, gasAOF, type IPRResult } from "@/lib/ipr-models";
import { downloadCSV } from "@/lib/csv";
import { fmt } from "@/lib/utils";
import { useLocalStorage } from "@/lib/use-local-storage";
import { useTranslation } from "@/lib/i18n";
import { useFluid } from "@/lib/fluid";
import { validateInputs, type Issue } from "@/lib/validation";
import { PetroleumChart, type ChartSeries } from "./petroleum-chart";
import { ScenarioManager } from "./scenario-manager";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ScrollArea } from "./ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Switch } from "./ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

type OilModel = "vogel" | "fetkovich" | "wiggins" | "darcy" | "joshi" | "composite";

const OIL_COLOR: Record<OilModel, string> = {
  vogel: "#2ECC71",
  fetkovich: "#E74C3C",
  wiggins: "#9B59B6",
  darcy: "#3498DB",
  joshi: "#16A085",
  composite: "#F39C12",
};

const OIL_LABEL: Record<OilModel, string> = {
  vogel: "Vogel",
  fetkovich: "Fetkovich",
  wiggins: "Wiggins",
  darcy: "Darcy (Vertical)",
  joshi: "Joshi (Horizontal)",
  composite: "Compuesto (Pr > Pb)",
};

const GAS_COLOR = "#E67E22";

interface OilForm {
  pres: string;
  qmax: string;
  c: string;
  n: string;
  k: string;
  h: string;
  mu: string;
  bo: string;
  re: string;
  rw: string;
  skin: string;
  L: string;
  j: string;
  pb: string;
}

interface GasForm {
  pres: string;
  c: string;
  n: string;
}

const OIL_DEFAULTS: OilForm = {
  pres: "3000",
  qmax: "1500",
  c: "0.5",
  n: "1.0",
  k: "50",
  h: "30",
  mu: "1.5",
  bo: "1.2",
  re: "1000",
  rw: "0.328",
  skin: "0",
  L: "1500",
  j: "1.2",
  pb: "1800",
};

const GAS_DEFAULTS: GasForm = {
  pres: "3500",
  c: "0.0001",
  n: "0.85",
};

const num = (s: string) => {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
};

interface OilResult {
  kind: "oil";
  model: OilModel;
  data: IPRResult;
}
interface GasResult {
  kind: "gas";
  data: IPRResult;
  aof: number;
}
type Result = OilResult | GasResult;

interface OverlayCurve {
  model: OilModel;
  data: IPRResult;
}

export function IPRTab() {
  const { t } = useTranslation();
  const { fluid } = useFluid();
  const [model, setModel] = useLocalStorage<OilModel>("ipr-model", "vogel");
  const [oilForm, setOilForm] = useLocalStorage<OilForm>("ipr-oil-form", OIL_DEFAULTS);
  const [gasForm, setGasForm] = useLocalStorage<GasForm>("ipr-gas-form", GAS_DEFAULTS);
  const [scale, setScale] = useState<"linear" | "log">("linear");
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<Issue[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [overlay, setOverlay] = useState<OverlayCurve[]>([]);

  const updateOil = (key: keyof OilForm) => (v: string) =>
    setOilForm((s) => ({ ...s, [key]: v }));
  const updateGas = (key: keyof GasForm) => (v: string) =>
    setGasForm((s) => ({ ...s, [key]: v }));

  useEffect(() => {
    setResult(null);
    setOverlay([]);
    setError(null);
  }, [fluid]);

  function buildOil(curModel: OilModel): IPRResult {
    const pres = num(oilForm.pres);
    if (pres <= 0) throw new Error("La Presión de yacimiento debe ser mayor a 0.");
    if (curModel === "vogel") return IPR.vogel(num(oilForm.qmax), pres);
    if (curModel === "wiggins") return IPR.wiggins(num(oilForm.qmax), pres);
    if (curModel === "fetkovich")
      return IPR.fetkovich(num(oilForm.c), num(oilForm.n), pres);
    if (curModel === "darcy")
      return IPR.darcy(
        num(oilForm.k),
        num(oilForm.h),
        num(oilForm.mu),
        num(oilForm.bo),
        num(oilForm.re),
        num(oilForm.rw),
        num(oilForm.skin),
        pres
      );
    if (curModel === "joshi")
      return IPR.joshi(
        num(oilForm.k),
        num(oilForm.h),
        num(oilForm.mu),
        num(oilForm.bo),
        num(oilForm.re),
        num(oilForm.rw),
        num(oilForm.L),
        pres
      );
    return IPR.composite(num(oilForm.j), pres, num(oilForm.pb));
  }

  function compute() {
    setError(null);
    try {
      if (fluid === "gas") {
        const pres = num(gasForm.pres);
        const c = num(gasForm.c);
        const n = num(gasForm.n);
        if (pres <= 0) throw new Error("La Presión de yacimiento debe ser mayor a 0.");
        if (c <= 0) throw new Error("El coeficiente C debe ser mayor a 0.");
        if (n <= 0) throw new Error("El exponente n debe ser mayor a 0.");
        setWarnings(validateInputs({ pres, n }));
        const data = IPR.gas(c, n, pres);
        setResult({ kind: "gas", data, aof: gasAOF(c, n, pres) });
        setOverlay([]);
        return;
      }
      const data = buildOil(model);
      setWarnings(
        validateInputs({
          pres: num(oilForm.pres),
          qmax: num(oilForm.qmax),
        })
      );
      setResult({ kind: "oil", model, data });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error en el cálculo.");
      setResult(null);
    }
  }

  function addOverlay() {
    if (fluid !== "oil" || !result || result.kind !== "oil") return;
    try {
      const data = buildOil(model);
      if (overlay.find((o) => o.model === model) || result.model === model) return;
      setOverlay((o) => [...o, { model, data }]);
    } catch {
      /* ignore — main compute() ya muestra error */
    }
  }

  function clearOverlay() {
    setOverlay([]);
  }

  function reset() {
    if (fluid === "oil") setOilForm(OIL_DEFAULTS);
    else setGasForm(GAS_DEFAULTS);
    setResult(null);
    setOverlay([]);
    setError(null);
    setWarnings([]);
  }

  const series = useMemo<ChartSeries[]>(() => {
    if (!result) return [];
    if (result.kind === "gas") {
      return [{ name: "IPR — Gas (Back-Pressure)", color: GAS_COLOR, points: result.data.points }];
    }
    const main: ChartSeries = {
      name: `IPR — ${OIL_LABEL[result.model]}`,
      color: OIL_COLOR[result.model],
      points: result.data.points,
    };
    const extras: ChartSeries[] = overlay.map((o) => ({
      name: `Overlay · ${OIL_LABEL[o.model]}`,
      color: OIL_COLOR[o.model],
      points: o.data.points,
      dashed: true,
    }));
    return [main, ...extras];
  }, [result, overlay]);

  const xLabel =
    result?.kind === "gas" ? "Caudal Qsc [MMscfd]" : "Caudal Q [STB/d]";
  const qHeader =
    result?.kind === "gas" ? "Caudal (MMscfd)" : "Caudal (STB/d)";

  const tableRows = useMemo(() => {
    if (!result) return [];
    return [...result.data.points].reverse();
  }, [result]);

  function exportCSV() {
    if (!result) return;
    const header = ["Pwf (psi)", qHeader];
    const rows: Array<Array<string | number>> = [header];
    for (const p of [...result.data.points].reverse()) {
      rows.push([p.pwf.toFixed(4), p.q.toFixed(6)]);
    }
    const filename =
      result.kind === "gas"
        ? "ipr-gas.csv"
        : `ipr-${result.model}.csv`;
    downloadCSV(rows, filename);
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr] print-full">
      <Card className="anim-fade-in no-print">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2">
            {fluid === "oil" ? <Droplet className="h-4 w-4 text-primary" /> : <Wind className="h-4 w-4 text-primary" />}
            {fluid === "oil" ? t("common.oil") : t("common.gas")}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={reset} aria-label="Reset">
            <RefreshCcw className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {fluid === "oil" && (
            <div className="space-y-1.5">
              <Label>{t("common.model")}</Label>
              <Select value={model} onValueChange={(v) => setModel(v as OilModel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(OIL_LABEL) as OilModel[]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {OIL_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-3 rounded-md border border-border/50 bg-muted/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {t("common.parameters")}
            </p>

            {fluid === "gas" ? (
              <>
                <Field label="Presión Yac. Pr (psi)" value={gasForm.pres} onChange={updateGas("pres")} />
                <Field label="Coeficiente C (MMscfd/psi^2n)" value={gasForm.c} onChange={updateGas("c")} />
                <Field label="Exponente n (0.5–1.0)" value={gasForm.n} onChange={updateGas("n")} />
                <p className="text-xs italic text-muted-foreground">
                  qsc = C · (Pr² − Pwf²)^n &nbsp;(Rawlins-Schellhardt)
                </p>
              </>
            ) : (
              <>
                <Field label="Presión Yac. (psi)" value={oilForm.pres} onChange={updateOil("pres")} />

                {(model === "vogel" || model === "wiggins") && (
                  <Field label="Q max (STB/d)" value={oilForm.qmax} onChange={updateOil("qmax")} />
                )}

                {model === "fetkovich" && (
                  <>
                    <Field label="Coeficiente C" value={oilForm.c} onChange={updateOil("c")} />
                    <Field label="Exponente n (0.5–1.0)" value={oilForm.n} onChange={updateOil("n")} />
                    <p className="text-xs italic text-muted-foreground">Q = C · (Pr² − Pwf²)^n</p>
                  </>
                )}

                {(model === "darcy" || model === "joshi") && (
                  <>
                    <Field label="Permeabilidad k (md)" value={oilForm.k} onChange={updateOil("k")} />
                    <Field label="Espesor h (ft)" value={oilForm.h} onChange={updateOil("h")} />
                    <Field label="Viscosidad μ (cp)" value={oilForm.mu} onChange={updateOil("mu")} />
                    <Field label="Bo (rb/STB)" value={oilForm.bo} onChange={updateOil("bo")} />
                    <Field label="Radio drenaje re (ft)" value={oilForm.re} onChange={updateOil("re")} />
                    <Field label="Radio pozo rw (ft)" value={oilForm.rw} onChange={updateOil("rw")} />
                    {model === "darcy" && (
                      <Field label="Skin (S)" value={oilForm.skin} onChange={updateOil("skin")} />
                    )}
                    {model === "joshi" && (
                      <Field label="Longitud horizontal L (ft)" value={oilForm.L} onChange={updateOil("L")} />
                    )}
                  </>
                )}

                {model === "composite" && (
                  <>
                    <Field label="Índice productividad J (STB/d/psi)" value={oilForm.j} onChange={updateOil("j")} />
                    <Field label="Presión burbuja Pb (psi)" value={oilForm.pb} onChange={updateOil("pb")} />
                    <p className="text-xs italic text-muted-foreground">
                      Lineal sobre Pb · Vogel debajo
                    </p>
                  </>
                )}
              </>
            )}
          </div>

          <ScenarioManager
            storageKey={`ipr-${fluid}`}
            current={fluid === "gas" ? gasForm : oilForm}
            onLoad={(v) => {
              if (fluid === "gas") setGasForm(v as GasForm);
              else setOilForm(v as OilForm);
            }}
          />

          <Button className="w-full" onClick={compute}>
            <Calculator className="mr-2 h-4 w-4" />
            Calcular Curva IPR
          </Button>

          {fluid === "oil" && result?.kind === "oil" && (
            <div className="flex flex-col gap-2">
              <Button variant="secondary" size="sm" onClick={addOverlay}>
                <Layers className="mr-2 h-3.5 w-3.5" />
                {t("ipr.compare.add")}
              </Button>
              {overlay.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearOverlay}>
                  {t("ipr.compare.clear")} ({overlay.length})
                </Button>
              )}
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {warnings.length > 0 && (
            <Alert variant="warning" aria-live="polite">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t("warn.title")}</AlertTitle>
              <AlertDescription>
                <ul className="ml-3 list-disc space-y-0.5">
                  {warnings.map((w, i) => (
                    <li key={i}>{w.message}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {result?.kind === "gas" && (
            <Alert variant="info">
              <TrendingUp className="h-4 w-4" />
              <AlertTitle>{t("ipr.aof")}</AlertTitle>
              <AlertDescription className="font-mono">
                {fmt(result.aof, 6)} MMscfd
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="space-y-5">
        <Card className="anim-slide-up">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              {t("ipr.curve")}
            </CardTitle>
            <div className="flex items-center gap-3 no-print">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>{t("common.scale.linear")}</span>
                <Switch
                  checked={scale === "log"}
                  onCheckedChange={(v) => setScale(v ? "log" : "linear")}
                  aria-label="Toggle log scale"
                />
                <span>{t("common.scale.log")}</span>
              </div>
              <Button variant="outline" size="sm" onClick={exportCSV} disabled={!result}>
                <Download className="mr-2 h-3.5 w-3.5" />
                {t("common.export.csv")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {result ? (
              <PetroleumChart
                series={series}
                xLabel={xLabel}
                scale={scale}
                showBrush
              />
            ) : (
              <div className="flex h-[360px] items-center justify-center rounded-lg border border-dashed border-primary/30 bg-card text-sm text-muted-foreground">
                Calcula una curva para visualizarla aquí.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="anim-slide-up">
          <CardHeader className="pb-3">
            <CardTitle>{t("ipr.table")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-56 rounded-md border border-border/40">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Presión de Fondo (psi)</TableHead>
                    <TableHead>{qHeader}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground">
                        Sin datos.
                      </TableCell>
                    </TableRow>
                  )}
                  {tableRows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono">{fmt(row.pwf)}</TableCell>
                      <TableCell className="font-mono">
                        {result?.kind === "gas" ? fmt(row.q, 6) : fmt(row.q)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            {overlay.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="mr-1">{overlay.length}</Badge>
                modelo(s) superpuesto(s) en el gráfico
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 items-center gap-2">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
