import { useMemo, useState } from "react";
import { Calculator, GitCompareArrows } from "lucide-react";
import { IPR } from "@/lib/ipr-models";
import { calculatePwf31 } from "@/lib/vlp-models";
import { calculateGasPwf } from "@/lib/gas-vlp";
import { findOperatingPoint } from "@/lib/nodal";
import { useLocalStorage } from "@/lib/use-local-storage";
import { useTranslation } from "@/lib/i18n";
import { useFluid } from "@/lib/fluid";
import { fmt } from "@/lib/utils";
import { PetroleumChart, type ChartMarker, type ChartSeries } from "./petroleum-chart";
import { ScenarioManager } from "./scenario-manager";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface ScenForm {
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

const DEFAULTS_A: ScenForm = {
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

const DEFAULTS_B: ScenForm = {
  ...DEFAULTS_A,
  pwh: "250",
  gor: "500",
  bsw: "30",
  gasC: "0.00015",
};

const num = (s: string) => {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
};

const FIELDS_OIL: Array<{ key: keyof ScenForm; label: string }> = [
  { key: "depth", label: "Prof (ft)" },
  { key: "tid", label: "ID (in)" },
  { key: "twh", label: "T cab (°F)" },
  { key: "tbh", label: "T fdo (°F)" },
  { key: "pwh", label: "Pwh (psi)" },
  { key: "api", label: "API" },
  { key: "gsg", label: "γ gas" },
  { key: "wsg", label: "γ agua" },
  { key: "bw", label: "Bw" },
  { key: "gor", label: "GOR" },
  { key: "bsw", label: "BSW %" },
  { key: "pres", label: "P yac" },
  { key: "qmax", label: "Q max" },
];

const FIELDS_GAS: Array<{ key: keyof ScenForm; label: string }> = [
  { key: "depth", label: "Prof (ft)" },
  { key: "tid", label: "ID (in)" },
  { key: "twh", label: "T cab (°F)" },
  { key: "tbh", label: "T fdo (°F)" },
  { key: "pwh", label: "Pwh (psi)" },
  { key: "gsg", label: "γ gas" },
  { key: "pres", label: "P yac" },
  { key: "gasC", label: "C" },
  { key: "gasN", label: "n" },
];

function runOil(form: ScenForm) {
  const pres = num(form.pres);
  const qMax = num(form.qmax);
  if (pres <= 0 || qMax <= 0) return null;
  const ipr = IPR.vogel(qMax, pres, 60);
  const nPoints = 18;
  const qStart = Math.max(50, qMax * 0.05);
  const qStep = (qMax - qStart) / (nPoints - 1);
  const vlp: { q: number; pwf: number }[] = [];
  for (let j = 0; j < nPoints; j++) {
    const q = qStart + qStep * j;
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
    });
    vlp.push({ q, pwf: r.pwf });
  }
  const op = findOperatingPoint(ipr.points, vlp);
  return { ipr: ipr.points, vlp, op, qLabel: "STB/d" };
}

function runGas(form: ScenForm) {
  const pres = num(form.pres);
  const c = num(form.gasC);
  const n = num(form.gasN);
  if (pres <= 0 || c <= 0 || n <= 0) return null;
  const ipr = IPR.gas(c, n, pres, 40);
  const aof = ipr.points[0].q;
  const nPoints = 18;
  const qMin = Math.max(0.01, aof * 0.05);
  const qStep = (aof - qMin) / (nPoints - 1);
  const vlp: { q: number; pwf: number }[] = [];
  for (let j = 0; j < nPoints; j++) {
    const q = qMin + qStep * j;
    const r = calculateGasPwf({
      lengthFt: num(form.depth),
      tubingIdIn: num(form.tid),
      pWh: num(form.pwh),
      tempWhF: num(form.twh),
      tempBhF: num(form.tbh),
      qGasMMscfd: q,
      gasSg: num(form.gsg),
    });
    vlp.push({ q, pwf: r.pwf });
  }
  const op = findOperatingPoint(ipr.points, vlp);
  return { ipr: ipr.points, vlp, op, qLabel: "MMscfd" };
}

export function CompareTab() {
  const { t } = useTranslation();
  const { fluid } = useFluid();
  const [a, setA] = useLocalStorage<ScenForm>("cmp-a", DEFAULTS_A);
  const [b, setB] = useLocalStorage<ScenForm>("cmp-b", DEFAULTS_B);
  const [resA, setResA] = useState<ReturnType<typeof runOil>>(null);
  const [resB, setResB] = useState<ReturnType<typeof runOil>>(null);

  function compute() {
    const fn = fluid === "gas" ? runGas : runOil;
    setResA(fn(a));
    setResB(fn(b));
  }

  const series = useMemo<ChartSeries[]>(() => {
    const out: ChartSeries[] = [];
    if (resA) {
      out.push({ name: "IPR · A", color: "#2ECC71", points: resA.ipr });
      out.push({ name: "VLP · A", color: "#3498DB", points: resA.vlp });
    }
    if (resB) {
      out.push({ name: "IPR · B", color: "#16A085", points: resB.ipr, dashed: true });
      out.push({ name: "VLP · B", color: "#E67E22", points: resB.vlp, dashed: true });
    }
    return out;
  }, [resA, resB]);

  const markers = useMemo<ChartMarker[]>(() => {
    const out: ChartMarker[] = [];
    if (resA?.op) out.push({ q: resA.op.q, pwf: resA.op.pwf, label: "A", color: "#3498DB" });
    if (resB?.op) out.push({ q: resB.op.q, pwf: resB.op.pwf, label: "B", color: "#E67E22" });
    return out;
  }, [resA, resB]);

  const FIELDS = fluid === "gas" ? FIELDS_GAS : FIELDS_OIL;
  const qLabel = fluid === "gas" ? "MMscfd" : "STB/d";

  return (
    <div className="space-y-5">
      <Card className="anim-fade-in">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <GitCompareArrows className="h-4 w-4 text-primary" />
            Comparación de escenarios
            <Badge variant={fluid === "gas" ? "warning" : "secondary"}>
              {fluid === "gas" ? t("common.gas") : t("common.oil")}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ScenarioForm
              title="Escenario A"
              form={a}
              fields={FIELDS}
              onChange={setA}
              accent="bg-emerald-500/10 border-emerald-500/30"
              storageKey={`cmp-a-${fluid}`}
            />
            <ScenarioForm
              title="Escenario B"
              form={b}
              fields={FIELDS}
              onChange={setB}
              accent="bg-orange-500/10 border-orange-500/30"
              storageKey={`cmp-b-${fluid}`}
            />
          </div>
          <Button onClick={compute} className="mt-4 w-full">
            <Calculator className="mr-2 h-4 w-4" />
            {t("common.calculate")}
          </Button>
        </CardContent>
      </Card>

      <Card className="anim-slide-up">
        <CardHeader className="pb-3">
          <CardTitle>Comparativa A vs B</CardTitle>
        </CardHeader>
        <CardContent>
          {series.length > 0 ? (
            <PetroleumChart
              series={series}
              markers={markers}
              showBrush
              height={420}
              xLabel={`Caudal Q [${qLabel}]`}
            />
          ) : (
            <div className="flex h-[360px] items-center justify-center rounded-lg border border-dashed border-primary/30 bg-card text-sm text-muted-foreground">
              Define los dos escenarios y calcula.
            </div>
          )}
        </CardContent>
      </Card>

      {resA?.op && resB?.op && (
        <Card className="anim-slide-up">
          <CardContent className="grid grid-cols-2 gap-4 pt-4">
            <Stat title="Operación A" q={resA.op.q} pwf={resA.op.pwf} qLabel={qLabel} color="text-emerald-700 dark:text-emerald-300" />
            <Stat title="Operación B" q={resB.op.q} pwf={resB.op.pwf} qLabel={qLabel} color="text-orange-700 dark:text-orange-300" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ScenarioForm({
  title,
  form,
  fields,
  onChange,
  accent,
  storageKey,
}: {
  title: string;
  form: ScenForm;
  fields: Array<{ key: keyof ScenForm; label: string }>;
  onChange: (s: ScenForm) => void;
  accent: string;
  storageKey: string;
}) {
  return (
    <div className={`rounded-md border p-3 ${accent}`}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide">{title}</p>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
        {fields.map((f) => (
          <div key={f.key} className="grid grid-cols-2 items-center gap-1">
            <Label className="text-[10px] uppercase tracking-wide">{f.label}</Label>
            <Input
              className="h-8"
              value={form[f.key]}
              onChange={(e) => onChange({ ...form, [f.key]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <div className="mt-2">
        <ScenarioManager
          storageKey={storageKey}
          current={form}
          onLoad={(v) => onChange(v as ScenForm)}
        />
      </div>
    </div>
  );
}

function Stat({
  title,
  q,
  pwf,
  qLabel,
  color,
}: {
  title: string;
  q: number;
  pwf: number;
  qLabel: string;
  color: string;
}) {
  return (
    <div className="rounded-md border border-border/40 bg-muted/30 p-3 text-center">
      <p className={`text-xs font-semibold uppercase tracking-wide ${color}`}>{title}</p>
      <p className="mt-1 font-mono text-lg">
        q = {fmt(q, qLabel === "MMscfd" ? 4 : 1)} <span className="text-xs text-muted-foreground">{qLabel}</span>
      </p>
      <p className="font-mono text-sm">
        Pwf = {fmt(pwf, 1)} <span className="text-xs text-muted-foreground">psi</span>
      </p>
    </div>
  );
}
