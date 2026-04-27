import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Download,
  RefreshCcw,
  XCircle,
} from "lucide-react";
import { IPR } from "@/lib/ipr-models";
import {
  calculatePwf31,
  type VLPCorrelation,
  type VLPSteps,
} from "@/lib/vlp-models";
import { calculateGasPwf } from "@/lib/gas-vlp";
import { findOperatingPoint } from "@/lib/nodal";
import { downloadCSV } from "@/lib/csv";
import { fmt } from "@/lib/utils";
import { useLocalStorage } from "@/lib/use-local-storage";
import { useTranslation } from "@/lib/i18n";
import { useFluid } from "@/lib/fluid";
import { validateInputs, type Issue } from "@/lib/validation";
import { PetroleumChart, type ChartMarker } from "./petroleum-chart";
import { DepthProfileChart } from "./depth-profile-chart";
import { FlowRegimeMap } from "./flow-regime-map";
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

interface VLPForm {
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
  inclination: string;
  // gas-only
  gasC: string;
  gasN: string;
}

const DEFAULTS: VLPForm = {
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
  inclination: "0",
  gasC: "0.0001",
  gasN: "0.85",
};

const num = (s: string) => {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
};

interface NodalResult {
  iprPoints: { q: number; pwf: number }[];
  vlpPoints: { q: number; pwf: number }[];
  lastSteps: VLPSteps | Record<string, number>;
  converged: boolean;
  iterations: number;
  operatingPoint: { q: number; pwf: number } | null;
  pres: number;
  qLabel: string;
  fluid: "oil" | "gas";
}

export function VLPTab() {
  const { t } = useTranslation();
  const { fluid } = useFluid();
  const [form, setForm] = useLocalStorage<VLPForm>("vlp-form", DEFAULTS);
  const [correlation, setCorrelation] = useLocalStorage<VLPCorrelation>(
    "vlp-correlation",
    "poettmann"
  );
  const [stepperMode, setStepperMode] = useLocalStorage<boolean>("vlp-stepper", false);
  const [activeStep, setActiveStep] = useState<0 | 1 | 2>(0);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<Issue[]>([]);
  const [result, setResult] = useState<NodalResult | null>(null);

  const update = (key: keyof VLPForm) => (v: string) =>
    setForm((s) => ({ ...s, [key]: v }));

  const SECTIONS_OIL: Array<{
    id: "geom" | "prod" | "ipr";
    fields: Array<{ key: keyof VLPForm; label: string }>;
  }> = [
    {
      id: "geom",
      fields: [
        { key: "depth", label: "Profundidad (ft)" },
        { key: "tid", label: "Tubing ID (in)" },
        { key: "twh", label: "Temp. Cabeza (°F)" },
        { key: "tbh", label: "Temp. Fondo (°F)" },
        { key: "inclination", label: "Inclinación (° vs vertical)" },
      ],
    },
    {
      id: "prod",
      fields: [
        { key: "pwh", label: "P Cabeza (psi)" },
        { key: "api", label: "API Petróleo" },
        { key: "gsg", label: "Gravedad Gas" },
        { key: "wsg", label: "Gravedad Agua" },
        { key: "bw", label: "Bw (rb/STB)" },
        { key: "gor", label: "GOR (scf/STB)" },
        { key: "bsw", label: "Corte de Agua %" },
      ],
    },
    {
      id: "ipr",
      fields: [
        { key: "pres", label: "Presión Yac. (psi)" },
        { key: "qmax", label: "Q Max (STB/d)" },
      ],
    },
  ];

  const SECTIONS_GAS: Array<{
    id: "geom" | "prod" | "ipr";
    fields: Array<{ key: keyof VLPForm; label: string }>;
  }> = [
    {
      id: "geom",
      fields: [
        { key: "depth", label: "Profundidad (ft)" },
        { key: "tid", label: "Tubing ID (in)" },
        { key: "twh", label: "Temp. Cabeza (°F)" },
        { key: "tbh", label: "Temp. Fondo (°F)" },
        { key: "inclination", label: "Inclinación (° vs vertical)" },
      ],
    },
    {
      id: "prod",
      fields: [
        { key: "pwh", label: "P Cabeza (psi)" },
        { key: "gsg", label: "Gravedad Gas" },
      ],
    },
    {
      id: "ipr",
      fields: [
        { key: "pres", label: "Presión Yac. (psi)" },
        { key: "gasC", label: "C (MMscfd/psi^2n)" },
        { key: "gasN", label: "n (0.5–1.0)" },
      ],
    },
  ];

  const SECTIONS = fluid === "gas" ? SECTIONS_GAS : SECTIONS_OIL;

  function computeOil() {
    const pres = num(form.pres);
    const qMax = num(form.qmax);
    if (pres <= 0 || qMax <= 0)
      throw new Error("Verifica los datos IPR (Presión Yac. y Q Max).");

    setWarnings(
      validateInputs({
        api: num(form.api),
        bsw: num(form.bsw),
        gor: num(form.gor),
        tid: num(form.tid),
        depth: num(form.depth),
        pwh: num(form.pwh),
        pres,
        qmax: qMax,
        twh: num(form.twh),
        tbh: num(form.tbh),
        gsg: num(form.gsg),
        wsg: num(form.wsg),
      })
    );

    const ipr = IPR.vogel(qMax, pres, 60);
    const inclination = num(form.inclination);
    const nPoints = 20;
    const qStart = Math.max(50, qMax * 0.05);
    const qStep = (qMax - qStart) / (nPoints - 1);
    const vlpPoints: { q: number; pwf: number }[] = [];
    let lastSteps: VLPSteps = {};
    let converged = false;
    let iterations = 0;
    for (let i = 0; i < nPoints; i++) {
      const q = qStart + qStep * i;
      const r = calculatePwf31({
        lengthFt: num(form.depth),
        tubingIdIn: num(form.tid),
        pWh: num(form.pwh),
        tempWhF: num(form.twh),
        tempBhF: num(form.tbh),
        qLiqBpd: q,
        gor: num(form.gor),
        bsw: num(form.bsw),
        api: num(form.api),
        gasSg: num(form.gsg),
        waterSg: num(form.wsg),
        bw: num(form.bw),
        correlation,
        inclinationDeg: inclination,
      });
      vlpPoints.push({ q, pwf: r.pwf });
      lastSteps = r.steps;
      converged = r.converged;
      iterations = r.iterations;
    }
    const op = findOperatingPoint(ipr.points, vlpPoints);
    return {
      iprPoints: ipr.points,
      vlpPoints,
      lastSteps,
      converged,
      iterations,
      operatingPoint: op,
      pres,
      qLabel: "STB/d",
      fluid: "oil" as const,
    };
  }

  function computeGas() {
    const pres = num(form.pres);
    const c = num(form.gasC);
    const n = num(form.gasN);
    if (pres <= 0 || c <= 0 || n <= 0)
      throw new Error("Verifica los datos IPR de gas (Pr, C, n).");

    setWarnings(
      validateInputs({
        tid: num(form.tid),
        depth: num(form.depth),
        pwh: num(form.pwh),
        pres,
        twh: num(form.twh),
        tbh: num(form.tbh),
        gsg: num(form.gsg),
        n,
      })
    );

    const ipr = IPR.gas(c, n, pres, 40);
    const aof = ipr.points[0].q; // Pwf=0 → AOF
    const qMin = Math.max(0.01, aof * 0.05);
    const nPoints = 18;
    const qStep = (aof - qMin) / (nPoints - 1);
    const vlpPoints: { q: number; pwf: number }[] = [];
    let lastSteps: Record<string, number> = {};
    let converged = false;
    let iterations = 0;
    const inclination = num(form.inclination);
    for (let i = 0; i < nPoints; i++) {
      const q = qMin + qStep * i;
      const r = calculateGasPwf({
        lengthFt: num(form.depth),
        tubingIdIn: num(form.tid),
        pWh: num(form.pwh),
        tempWhF: num(form.twh),
        tempBhF: num(form.tbh),
        qGasMMscfd: q,
        gasSg: num(form.gsg),
        inclinationDeg: inclination,
      });
      vlpPoints.push({ q, pwf: r.pwf });
      lastSteps = r.steps;
      converged = r.converged;
      iterations = r.iterations;
    }
    const op = findOperatingPoint(ipr.points, vlpPoints);
    return {
      iprPoints: ipr.points,
      vlpPoints,
      lastSteps,
      converged,
      iterations,
      operatingPoint: op,
      pres,
      qLabel: "MMscfd",
      fluid: "gas" as const,
    };
  }

  function compute() {
    setError(null);
    try {
      setResult(fluid === "gas" ? computeGas() : computeOil());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fallo en el cálculo.");
      setResult(null);
    }
  }

  function reset() {
    setForm(DEFAULTS);
    setResult(null);
    setError(null);
    setWarnings([]);
    setActiveStep(0);
  }

  const series = useMemo(() => {
    if (!result) return [];
    return [
      {
        name: result.fluid === "gas" ? "IPR (Back-Pressure)" : "IPR (Vogel)",
        color: "#2ECC71",
        points: result.iprPoints,
      },
      { name: "VLP (calculada)", color: "#3498DB", points: result.vlpPoints },
    ];
  }, [result]);

  const markers = useMemo<ChartMarker[]>(() => {
    if (!result?.operatingPoint) return [];
    return [
      {
        q: result.operatingPoint.q,
        pwf: result.operatingPoint.pwf,
        label: "Operación",
        color: "#E74C3C",
      },
    ];
  }, [result]);

  const referenceLines = useMemo(() => {
    if (!result) return [];
    return [{ axis: "y" as const, value: result.pres, label: "P_yac", color: "#8A56AC" }];
  }, [result]);

  function exportSteps() {
    if (!result) return;
    const rows: Array<Array<string | number>> = [["Paso / Variable", "Valor"]];
    for (const [k, v] of Object.entries(result.lastSteps)) {
      rows.push([k, Number.isFinite(v as number) ? (v as number).toFixed(6) : "—"]);
    }
    if (result.operatingPoint) {
      rows.push([], ["Punto de operación", ""], [`q (${result.qLabel})`, result.operatingPoint.q.toFixed(4)]);
      rows.push(["Pwf (psi)", result.operatingPoint.pwf.toFixed(2)]);
    }
    downloadCSV(rows, `vlp-${fluid}-pasos.csv`);
  }

  function exportCurves() {
    if (!result) return;
    const ipr = new Map(result.iprPoints.map((p) => [+p.pwf.toFixed(4), p.q]));
    const vlp = new Map(result.vlpPoints.map((p) => [+p.pwf.toFixed(4), p.q]));
    const allPwf = Array.from(new Set([...ipr.keys(), ...vlp.keys()])).sort((a, b) => b - a);
    const rows: Array<Array<string | number>> = [
      ["Pwf (psi)", `Q_IPR (${result.qLabel})`, `Q_VLP (${result.qLabel})`],
    ];
    for (const p of allPwf) {
      rows.push([p, ipr.get(p) ?? "", vlp.get(p) ?? ""]);
    }
    downloadCSV(rows, `nodal-${fluid}-curves.csv`);
  }

  const visibleSections = stepperMode ? [SECTIONS[activeStep]] : SECTIONS;
  const sectionLabels: Record<"geom" | "prod" | "ipr", string> = {
    geom: t("step.geom"),
    prod: t("step.prod"),
    ipr: t("step.ipr"),
  };

  // Datos para el perfil P vs profundidad y mapa de regimen
  const opPwf = result?.operatingPoint?.pwf ?? result?.lastSteps["Paso 31 (Pwf, psi)"] ?? 0;
  const vsl = result?.lastSteps["Paso 16 (VSL, ft/s)"];
  const vsg = result?.lastSteps["Paso 17 (VSG, ft/s)"];
  const pBubble = result?.lastSteps["Paso 2 (Pb, psi)"];

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr] print-full">
      <Card className="anim-fade-in no-print">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2">
            {t("vlp.title")}
            <Badge variant={fluid === "gas" ? "warning" : "secondary"}>
              {fluid === "gas" ? t("common.gas") : t("common.oil")}
            </Badge>
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={reset} aria-label="Reset">
            <RefreshCcw className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-border/40 bg-muted/30 p-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-medium">Stepper</span>
              <Switch
                checked={stepperMode}
                onCheckedChange={setStepperMode}
                aria-label="Toggle stepper mode"
              />
            </div>
            {stepperMode && (
              <div className="flex items-center gap-1">
                {SECTIONS.map((s, i) => (
                  <Badge
                    key={s.id}
                    variant={i === activeStep ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setActiveStep(i as 0 | 1 | 2)}
                  >
                    {i + 1}. {sectionLabels[s.id]}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {fluid === "oil" && (
            <div className="mb-3 space-y-1.5">
              <Label className="text-xs">Correlación VLP</Label>
              <Select value={correlation} onValueChange={(v) => setCorrelation(v as VLPCorrelation)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="poettmann">Poettmann-Carpenter (PDF)</SelectItem>
                  <SelectItem value="hagedorn-brown">Hagedorn-Brown</SelectItem>
                  <SelectItem value="beggs-brill">Beggs-Brill</SelectItem>
                  <SelectItem value="duns-ros">Duns-Ros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {fluid === "gas" && (
            <div className="mb-3 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-2 text-xs">
              Gas: método Cullender-Smith (Z̄·T̄) con fricción Moody.
            </div>
          )}

          <ScrollArea className="h-[360px] pr-2">
            <div className="space-y-4">
              {visibleSections.map((section) => (
                <div
                  key={section.id}
                  className="space-y-2 rounded-md border border-border/40 bg-muted/30 p-3 anim-fade-in"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {sectionLabels[section.id]}
                  </p>
                  {section.fields.map((f) => (
                    <div key={f.key} className="grid grid-cols-2 items-center gap-2">
                      <Label className="text-xs">{f.label}</Label>
                      <Input
                        type="number"
                        step="any"
                        value={form[f.key]}
                        onChange={(e) => update(f.key)(e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="mt-3">
            <ScenarioManager
              storageKey={`vlp-${fluid}`}
              current={form}
              onLoad={(v) => setForm(v as VLPForm)}
            />
          </div>

          {stepperMode ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                disabled={activeStep === 0}
                onClick={() => setActiveStep((s) => Math.max(0, s - 1) as 0 | 1 | 2)}
              >
                <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                {t("step.prev")}
              </Button>
              {activeStep < 2 ? (
                <Button onClick={() => setActiveStep((s) => Math.min(2, s + 1) as 0 | 1 | 2)}>
                  {t("step.next")}
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button onClick={compute}>
                  <Calculator className="mr-1 h-3.5 w-3.5" />
                  {t("common.calculate")}
                </Button>
              )}
            </div>
          ) : (
            <Button className="mt-4 w-full" onClick={compute}>
              <Calculator className="mr-2 h-4 w-4" />
              {t("vlp.calc")}
            </Button>
          )}

          {error && (
            <Alert variant="destructive" className="mt-3">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {warnings.length > 0 && (
            <Alert variant="warning" className="mt-3" aria-live="polite">
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

          {result && (
            <Alert
              variant={result.converged ? "success" : "warning"}
              className="mt-3"
              aria-live="polite"
            >
              {result.converged ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <AlertTitle>
                {result.converged ? t("vlp.converged") : t("vlp.notConverged")}
              </AlertTitle>
              <AlertDescription className="font-mono">
                Iter: {result.iterations}
              </AlertDescription>
            </Alert>
          )}

          {result?.operatingPoint && (
            <Alert variant="info" className="mt-3">
              <Crosshair className="h-4 w-4" />
              <AlertTitle>{t("vlp.operating")}</AlertTitle>
              <AlertDescription className="font-mono">
                q = {fmt(result.operatingPoint.q, 2)} {result.qLabel} · Pwf ={" "}
                {fmt(result.operatingPoint.pwf, 1)} psi
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="space-y-5">
        <Card className="anim-slide-up">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle>{t("vlp.chart.title")}</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCurves}
              disabled={!result}
              className="no-print"
            >
              <Download className="mr-2 h-3.5 w-3.5" />
              {t("common.export.csv")}
            </Button>
          </CardHeader>
          <CardContent>
            {result ? (
              <PetroleumChart
                series={series}
                markers={markers}
                referenceLines={referenceLines}
                showBrush
                xLabel={`Caudal Q [${result.qLabel}]`}
              />
            ) : (
              <div className="flex h-[360px] items-center justify-center rounded-lg border border-dashed border-primary/30 bg-card text-sm text-muted-foreground">
                Ejecuta el análisis nodal para ver la intersección VLP–IPR.
              </div>
            )}
          </CardContent>
        </Card>

        {result && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Card className="anim-slide-up">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Perfil P vs profundidad</CardTitle>
              </CardHeader>
              <CardContent>
                <DepthProfileChart
                  pWh={num(form.pwh)}
                  pwf={opPwf as number}
                  depth={num(form.depth)}
                  pBubble={typeof pBubble === "number" ? pBubble : undefined}
                />
              </CardContent>
            </Card>

            {fluid === "oil" && (
              <Card className="anim-slide-up">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Mapa de régimen de flujo</CardTitle>
                </CardHeader>
                <CardContent>
                  <FlowRegimeMap
                    vsl={typeof vsl === "number" ? vsl : undefined}
                    vsg={typeof vsg === "number" ? vsg : undefined}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <Card className="anim-slide-up">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle>{t("vlp.steps.title")}</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={exportSteps}
              disabled={!result}
              className="no-print"
            >
              <Download className="mr-2 h-3.5 w-3.5" />
              {t("common.export.csv")}
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-72 rounded-md border border-border/40">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paso / Variable</TableHead>
                    <TableHead>Valor calculado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result ? (
                    Object.entries(result.lastSteps).map(([k, v]) => (
                      <TableRow key={k}>
                        <TableCell className="font-medium">{k}</TableCell>
                        <TableCell className="font-mono">{fmt(v as number, 4)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground">
                        Sin datos.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
