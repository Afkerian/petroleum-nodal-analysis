import { useMemo, useState } from "react";
import { Calculator, Sliders } from "lucide-react";
import { IPR } from "@/lib/ipr-models";
import { calculatePwf31 } from "@/lib/vlp-models";
import { calculateGasPwf } from "@/lib/gas-vlp";
import { findOperatingPoint } from "@/lib/nodal";
import { useLocalStorage } from "@/lib/use-local-storage";
import { useTranslation } from "@/lib/i18n";
import { useFluid } from "@/lib/fluid";
import { fmt } from "@/lib/utils";
import { PetroleumChart, type ChartSeries, type ChartMarker } from "./petroleum-chart";
import { ScenarioManager } from "./scenario-manager";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

type SensParam = "pwh" | "gor" | "bsw" | "tid" | "depth" | "gsg";

const PARAM_LABEL: Record<SensParam, string> = {
  pwh: "Presión cabeza Pwh (psi)",
  gor: "GOR (scf/STB)",
  bsw: "Corte de agua BSW (%)",
  tid: "Tubing ID (in)",
  depth: "Profundidad (ft)",
  gsg: "Gravedad gas γ_g",
};

const PARAMS_OIL: SensParam[] = ["pwh", "gor", "bsw", "tid", "depth", "gsg"];
const PARAMS_GAS: SensParam[] = ["pwh", "tid", "depth", "gsg"];

interface SensForm {
  parameter: SensParam;
  from: string;
  to: string;
  steps: string;
  depth: string;
  tid: string;
  twh: string;
  tbh: string;
  pwh: string;
  api: string;
  gsg: string;
  wsg: string;
  bw: string;
  gor: string;
  bsw: string;
  pres: string;
  qmax: string;
  gasC: string;
  gasN: string;
}

const DEFAULTS: SensForm = {
  parameter: "pwh",
  from: "100",
  to: "400",
  steps: "5",
  depth: "8000",
  tid: "2.441",
  twh: "100",
  tbh: "200",
  pwh: "150",
  api: "30",
  gsg: "0.75",
  wsg: "1.02",
  bw: "1.0",
  gor: "800",
  bsw: "10",
  pres: "3000",
  qmax: "6774",
  gasC: "0.0001",
  gasN: "0.85",
};

const COLORS = [
  "#3498DB", "#E74C3C", "#2ECC71", "#9B59B6",
  "#E67E22", "#16A085", "#F39C12", "#34495E",
];

const num = (s: string) => {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
};

interface ScenResult {
  label: string;
  points: { q: number; pwf: number }[];
  operating: { q: number; pwf: number } | null;
}

export function SensitivityTab() {
  const { t } = useTranslation();
  const { fluid } = useFluid();
  const [form, setForm] = useLocalStorage<SensForm>("sens-form", DEFAULTS);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ScenResult[]>([]);
  const [iprPoints, setIprPoints] = useState<{ q: number; pwf: number }[]>([]);

  const update = <K extends keyof SensForm>(key: K) => (v: SensForm[K]) =>
    setForm((s) => ({ ...s, [key]: v }));

  const allowedParams = fluid === "gas" ? PARAMS_GAS : PARAMS_OIL;

  // Si el parámetro guardado no está permitido para el fluido actual, fallback a pwh
  const safeParam: SensParam = allowedParams.includes(form.parameter) ? form.parameter : "pwh";

  function runOilScenario(merged: SensForm, ipr: { q: number; pwf: number }[]): ScenResult {
    const qMax = num(merged.qmax);
    const nPoints = 18;
    const qStart = Math.max(50, qMax * 0.05);
    const qStep = (qMax - qStart) / (nPoints - 1);
    const vlp: { q: number; pwf: number }[] = [];
    for (let j = 0; j < nPoints; j++) {
      const q = qStart + qStep * j;
      const r = calculatePwf31({
        lengthFt: num(merged.depth),
        tubingIdIn: num(merged.tid),
        pWh: num(merged.pwh),
        tempWhF: num(merged.twh),
        tempBhF: num(merged.tbh),
        qLiqBpd: q,
        gor: num(merged.gor),
        bsw: num(merged.bsw),
        api: num(merged.api),
        gasSg: num(merged.gsg),
        waterSg: num(merged.wsg),
        bw: num(merged.bw),
      });
      vlp.push({ q, pwf: r.pwf });
    }
    const op = findOperatingPoint(ipr, vlp);
    const value = num(merged[safeParam] as string);
    return {
      label: `${PARAM_LABEL[safeParam].split(" ")[0]} = ${fmt(value, 1)}`,
      points: vlp,
      operating: op,
    };
  }

  function runGasScenario(merged: SensForm, ipr: { q: number; pwf: number }[]): ScenResult {
    const aof = ipr[0].q;
    const qMin = Math.max(0.01, aof * 0.05);
    const nPoints = 18;
    const qStep = (aof - qMin) / (nPoints - 1);
    const vlp: { q: number; pwf: number }[] = [];
    for (let j = 0; j < nPoints; j++) {
      const q = qMin + qStep * j;
      const r = calculateGasPwf({
        lengthFt: num(merged.depth),
        tubingIdIn: num(merged.tid),
        pWh: num(merged.pwh),
        tempWhF: num(merged.twh),
        tempBhF: num(merged.tbh),
        qGasMMscfd: q,
        gasSg: num(merged.gsg),
      });
      vlp.push({ q, pwf: r.pwf });
    }
    const op = findOperatingPoint(ipr, vlp);
    const value = num(merged[safeParam] as string);
    return {
      label: `${PARAM_LABEL[safeParam].split(" ")[0]} = ${fmt(value, 1)}`,
      points: vlp,
      operating: op,
    };
  }

  function run() {
    const from = num(form.from);
    const to = num(form.to);
    const stepsCount = Math.max(2, Math.min(12, Math.floor(num(form.steps))));
    if (to <= from) return;

    setRunning(true);
    try {
      const pres = num(form.pres);
      const ipr =
        fluid === "gas"
          ? IPR.gas(num(form.gasC), num(form.gasN), pres, 60).points
          : IPR.vogel(num(form.qmax), pres, 60).points;
      setIprPoints(ipr);

      const arr: ScenResult[] = [];
      for (let i = 0; i < stepsCount; i++) {
        const value = from + ((to - from) * i) / (stepsCount - 1);
        const merged = { ...form, [safeParam]: String(value) };
        arr.push(fluid === "gas" ? runGasScenario(merged, ipr) : runOilScenario(merged, ipr));
      }
      setResults(arr);
    } finally {
      setRunning(false);
    }
  }

  const series = useMemo<ChartSeries[]>(() => {
    if (results.length === 0) return [];
    const main: ChartSeries[] = [
      { name: fluid === "gas" ? "IPR (Back-Pressure)" : "IPR (Vogel)", color: "#2ECC71", points: iprPoints },
    ];
    return [
      ...main,
      ...results.map((r, i) => ({
        name: `VLP · ${r.label}`,
        color: COLORS[i % COLORS.length],
        points: r.points,
      })),
    ];
  }, [results, iprPoints, fluid]);

  const markers = useMemo<ChartMarker[]>(() => {
    return results
      .map((r, i) =>
        r.operating
          ? ({
              q: r.operating.q,
              pwf: r.operating.pwf,
              label: "",
              color: COLORS[i % COLORS.length],
            } as ChartMarker)
          : null
      )
      .filter((x): x is ChartMarker => x !== null);
  }, [results]);

  const qLabel = fluid === "gas" ? "MMscfd" : "STB/d";

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]">
      <Card className="anim-fade-in">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-primary" />
            {t("sens.title")}
            <Badge variant={fluid === "gas" ? "warning" : "secondary"}>
              {fluid === "gas" ? t("common.gas") : t("common.oil")}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("sens.parameter")}</Label>
            <Select
              value={safeParam}
              onValueChange={(v) => update("parameter")(v as SensParam)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowedParams.map((k) => (
                  <SelectItem key={k} value={k}>
                    {PARAM_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">{t("sens.from")}</Label>
              <Input value={form.from} onChange={(e) => update("from")(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{t("sens.to")}</Label>
              <Input value={form.to} onChange={(e) => update("to")(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{t("sens.steps")}</Label>
              <Input value={form.steps} onChange={(e) => update("steps")(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Escenario base (resto de parámetros): los del tab VLP — modifícalos allí si quieres
            otro punto de partida.
          </p>
          <ScenarioManager
            storageKey={`sens-${fluid}`}
            current={form}
            onLoad={(v) => setForm(v as SensForm)}
          />
          <Button className="w-full" onClick={run} disabled={running}>
            <Calculator className="mr-2 h-4 w-4" />
            {running ? t("common.loading") : t("sens.run")}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-5">
        <Card className="anim-slide-up">
          <CardHeader className="pb-3">
            <CardTitle>Curvas VLP variando {PARAM_LABEL[safeParam]}</CardTitle>
          </CardHeader>
          <CardContent>
            {results.length > 0 ? (
              <PetroleumChart
                series={series}
                markers={markers}
                showBrush
                height={420}
                xLabel={`Caudal Q [${qLabel}]`}
              />
            ) : (
              <div className="flex h-[360px] items-center justify-center rounded-lg border border-dashed border-primary/30 bg-card text-sm text-muted-foreground">
                Ejecuta el barrido para ver los resultados.
              </div>
            )}
          </CardContent>
        </Card>

        {results.length > 0 && (
          <Card className="anim-slide-up">
            <CardHeader className="pb-3">
              <CardTitle>Punto de operación por escenario</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-56 rounded-md border border-border/40">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Escenario</TableHead>
                      <TableHead>q* ({qLabel})</TableHead>
                      <TableHead>Pwf* (psi)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{r.label}</TableCell>
                        <TableCell className="font-mono">
                          {r.operating ? fmt(r.operating.q, fluid === "gas" ? 4 : 1) : "—"}
                        </TableCell>
                        <TableCell className="font-mono">
                          {r.operating ? fmt(r.operating.pwf, 1) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
