import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Calculator,
  Droplets,
  Gauge,
  Layers,
  Snowflake,
  Wind,
  Wrench,
  Zap,
} from "lucide-react";
import { liquidLoading } from "@/lib/liquid-loading";
import { erosionalCheck } from "@/lib/erosional-velocity";
import { chokeFamily, type ChokeCorrelation } from "@/lib/choke";
import {
  skinDeviation,
  skinHawkins,
  skinPartialPenetration,
  skinPerforation,
  skinTotal,
} from "@/lib/skin";
import { hydrateAtConditions, hammerschmidtDeltaT, type Inhibitor } from "@/lib/hydrate";
import { sandPrediction } from "@/lib/sand-prediction";
import { sweepTubing, STANDARD_TUBING_IDS } from "@/lib/tubing-optimizer";
import { gasLiftSweep } from "@/lib/gas-lift";
import { IPR } from "@/lib/ipr-models";
import { palettes } from "@/lib/palettes";
import { fmt } from "@/lib/utils";
import { useFluid } from "@/lib/fluid";
import { useLocalStorage } from "@/lib/use-local-storage";
import { PetroleumChart, type ChartSeries, type ChartMarker } from "./petroleum-chart";
import { KpiCard } from "./ui/kpi-card";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
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
import { InfoTip } from "./ui/info-tip";

interface PEForm {
  // Common
  pwh: string;
  twh: string;
  tubingId: string;
  gasSg: string;
  // Liquid loading
  rhoL: string;
  surfaceTension: string;
  // Erosional
  rhoMix: string;
  velocity: string;
  cFactor: string;
  // Choke
  qStb: string;
  glr: string;
  // Skin
  kForm: string;
  kDam: string;
  rDam: string;
  rWell: string;
  hPen: string;
  hRes: string;
  spf: string;
  perfLen: string;
  perfDia: string;
  inclination: string;
  // Hydrate
  pOper: string;
  tOper: string;
  inhibitor: Inhibitor;
  inhibitorPct: string;
  // Sand
  ucs: string;
  poisson: string;
  drawdown: string;
  // Tubing optimizer (uses base form)
  depth: string;
  tbh: string;
  api: string;
  wsg: string;
  bw: string;
  gor: string;
  bsw: string;
  pres: string;
  qmax: string;
  // Gas lift
  glrInjFrom: string;
  glrInjTo: string;
}

const DEFAULTS: PEForm = {
  pwh: "150", twh: "100", tubingId: "2.441", gasSg: "0.7",
  rhoL: "62.4", surfaceTension: "60",
  rhoMix: "10", velocity: "15", cFactor: "100",
  qStb: "1500", glr: "800",
  kForm: "50", kDam: "10", rDam: "2.5", rWell: "0.328",
  hPen: "20", hRes: "30",
  spf: "12", perfLen: "10", perfDia: "0.4",
  inclination: "30",
  pOper: "1500", tOper: "65", inhibitor: "methanol", inhibitorPct: "30",
  ucs: "1500", poisson: "0.25", drawdown: "800",
  depth: "8000", tbh: "200", api: "30", wsg: "1.02", bw: "1.0",
  gor: "800", bsw: "10", pres: "3000", qmax: "6774",
  glrInjFrom: "0", glrInjTo: "2000",
};

const num = (s: string) => {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
};

export function ProductionEngineeringTab() {
  const { fluid } = useFluid();
  const [form, setForm] = useLocalStorage<PEForm>("pe-form", DEFAULTS);
  const update = <K extends keyof PEForm>(k: K) => (v: PEForm[K]) => setForm({ ...form, [k]: v });

  const [chokeCorr, setChokeCorr] = useState<ChokeCorrelation>("gilbert");
  const [tubingResult, setTubingResult] = useState<ReturnType<typeof sweepTubing> | null>(null);
  const [gasLiftResult, setGasLiftResult] = useState<ReturnType<typeof gasLiftSweep> | null>(null);

  // ───── Cálculos en vivo ─────
  const ll = useMemo(
    () =>
      liquidLoading({
        pwh: num(form.pwh),
        tempWhF: num(form.twh),
        tubingIdIn: num(form.tubingId),
        gasSg: num(form.gasSg),
        rhoLiquid: num(form.rhoL),
        surfaceTension: num(form.surfaceTension),
      }),
    [form.pwh, form.twh, form.tubingId, form.gasSg, form.rhoL, form.surfaceTension]
  );

  const ev = useMemo(
    () =>
      erosionalCheck({
        rhoMixLbFt3: num(form.rhoMix),
        velocityFtS: num(form.velocity),
        tubingIdIn: num(form.tubingId),
        cFactor: num(form.cFactor),
      }),
    [form.rhoMix, form.velocity, form.tubingId, form.cFactor]
  );

  const skinParts = useMemo(() => {
    const h = skinHawkins({
      kFormation: num(form.kForm),
      kDamaged: num(form.kDam),
      rDamaged: num(form.rDam),
      rWell: num(form.rWell),
    });
    const pp = skinPartialPenetration({
      hPenetrated: num(form.hPen),
      hReservoir: num(form.hRes),
      rWell: num(form.rWell),
    });
    const pf = skinPerforation({
      shotsPerFt: num(form.spf),
      perfLengthIn: num(form.perfLen),
      perfDiameterIn: num(form.perfDia),
      rWell: num(form.rWell),
    });
    const dv = skinDeviation({
      inclinationDeg: num(form.inclination),
      hReservoir: num(form.hRes),
      rWell: num(form.rWell),
    });
    return skinTotal({ hawkins: h, partial: pp, perforation: pf, deviation: dv });
  }, [form.kForm, form.kDam, form.rDam, form.rWell, form.hPen, form.hRes, form.spf, form.perfLen, form.perfDia, form.inclination]);

  const hyd = useMemo(
    () => hydrateAtConditions(num(form.pOper), num(form.tOper), num(form.gasSg)),
    [form.pOper, form.tOper, form.gasSg]
  );
  const inhDeltaT = useMemo(
    () => hammerschmidtDeltaT(form.inhibitor, num(form.inhibitorPct)),
    [form.inhibitor, form.inhibitorPct]
  );

  const sand = useMemo(
    () =>
      sandPrediction({
        ucsPsi: num(form.ucs),
        poisson: num(form.poisson),
        drawdownPsi: num(form.drawdown),
      }),
    [form.ucs, form.poisson, form.drawdown]
  );

  // ───── Choke (Gilbert family) ─────
  const chokeData = useMemo(() => {
    const families = chokeFamily(
      [16, 24, 32, 48, 64, 96],
      num(form.qStb) * 2,
      num(form.glr),
      chokeCorr
    );
    const colors = palettes.viridis(families.length);
    return families.map((f, i) => ({
      name: `D = ${f.d}/64"`,
      color: colors[i],
      points: f.points.map((p) => ({ q: p.q, pwf: p.pwh })),
    })) as ChartSeries[];
  }, [form.qStb, form.glr, chokeCorr]);

  // ───── Tubing optimizer ─────
  function runTubing() {
    const ipr = IPR.vogel(num(form.qmax), num(form.pres), 60).points;
    const r = sweepTubing(
      {
        lengthFt: num(form.depth),
        pWh: num(form.pwh),
        tempWhF: num(form.twh),
        tempBhF: num(form.tbh),
        gor: num(form.gor),
        bsw: num(form.bsw),
        api: num(form.api),
        gasSg: num(form.gasSg),
        waterSg: num(form.wsg),
        bw: num(form.bw),
      },
      num(form.qmax),
      ipr
    );
    setTubingResult(r);
  }

  const tubingSeries = useMemo<ChartSeries[]>(() => {
    if (!tubingResult) return [];
    const colors = palettes.viridis(tubingResult.length);
    return [
      { name: "IPR (Vogel)", color: "#2ECC71", points: IPR.vogel(num(form.qmax), num(form.pres), 60).points },
      ...tubingResult.map((t, i) => ({
        name: `VLP · ID = ${t.id}"`,
        color: colors[i],
        points: t.vlp,
      })),
    ];
  }, [tubingResult, form.qmax, form.pres]);

  const tubingMarkers = useMemo<ChartMarker[]>(() => {
    if (!tubingResult) return [];
    const colors = palettes.viridis(tubingResult.length);
    return tubingResult.map((t, i) => ({
      q: t.qOp,
      pwf: t.pwfOp,
      label: `${t.id}"`,
      color: colors[i],
    } as ChartMarker));
  }, [tubingResult]);

  const tubingOptimum = useMemo(() => {
    if (!tubingResult) return null;
    return tubingResult.reduce((best, t) => (t.qOp > best.qOp ? t : best), tubingResult[0]);
  }, [tubingResult]);

  // ───── Gas Lift ─────
  function runGasLift() {
    const ipr = IPR.vogel(num(form.qmax), num(form.pres), 60).points;
    const r = gasLiftSweep({
      baseVLP: {
        lengthFt: num(form.depth),
        tubingIdIn: num(form.tubingId),
        pWh: num(form.pwh),
        tempWhF: num(form.twh),
        tempBhF: num(form.tbh),
        bsw: num(form.bsw),
        api: num(form.api),
        gasSg: num(form.gasSg),
        waterSg: num(form.wsg),
        bw: num(form.bw),
      },
      formationGor: num(form.gor),
      injectionGlrRange: [num(form.glrInjFrom), num(form.glrInjTo)],
      steps: 12,
      ipr,
      qMax: num(form.qmax),
    });
    setGasLiftResult(r);
  }

  const gasLiftOptimum = useMemo(() => {
    if (!gasLiftResult) return null;
    return gasLiftResult.reduce((best, p) => (p.qOp > best.qOp ? p : best), gasLiftResult[0]);
  }, [gasLiftResult]);

  return (
    <div className="space-y-5">
      {/* ─────────────────── KPIs primarios ─────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        {fluid === "gas" && (
          <KpiCard
            label="Liquid loading (Turner)"
            value={fmt(ll.qcTurnerMMscfd, 3)}
            unit="MMscfd"
            tone={ll.qcTurnerMMscfd < 1 ? "warning" : "success"}
            icon={<Droplets className="h-3.5 w-3.5" />}
            hint="q crítico para arrastrar líquidos"
          />
        )}
        <KpiCard
          label="Velocidad erosional"
          value={fmt(ev.vErosional, 1)}
          unit="ft/s"
          tone={ev.status === "exceeded" ? "danger" : ev.status === "warning" ? "warning" : "success"}
          icon={<Wind className="h-3.5 w-3.5" />}
          hint={`Margen: ${fmt(ev.marginPct, 1)}%`}
        />
        <KpiCard
          label="Skin total"
          value={fmt(skinParts.total, 2)}
          tone={skinParts.total > 5 ? "danger" : skinParts.total > 0 ? "warning" : "success"}
          icon={<Wrench className="h-3.5 w-3.5" />}
          hint="Componentes sumados"
        />
        <KpiCard
          label="Hidratos T_hyd"
          value={fmt(hyd.tHyd, 0)}
          unit="°F"
          tone={hyd.risk === "risk" ? "danger" : hyd.risk === "watch" ? "warning" : "success"}
          icon={<Snowflake className="h-3.5 w-3.5" />}
          hint={`ΔT vs operación: ${fmt(hyd.deltaT, 1)}°F`}
        />
        <KpiCard
          label="Drawdown crítico"
          value={fmt(sand.drawdownCritical, 0)}
          unit="psi"
          tone={sand.status === "risk" ? "danger" : sand.status === "watch" ? "warning" : "success"}
          icon={<Layers className="h-3.5 w-3.5" />}
          hint="Producción de arena"
        />
        <KpiCard
          label="Inhibidor ΔT"
          value={fmt(inhDeltaT, 1)}
          unit="°F"
          tone="default"
          icon={<Gauge className="h-3.5 w-3.5" />}
          hint={`${form.inhibitor} ${form.inhibitorPct}%`}
        />
      </div>

      {/* ─────────────────── Calculadoras ─────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Liquid loading */}
        <Card className="anim-fade-in">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Droplets className="h-4 w-4 text-primary" />
              Liquid Loading (gas wells)
              <InfoTip content="Turner: caudal mínimo para que el gas levante las gotas de líquido y evite el ahogamiento del pozo. Coleman = 0.7·Turner (sin factor de seguridad)." />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Row><Field label="Pwh (psi)" v={form.pwh} on={update("pwh")} /><Field label="T cabeza (°F)" v={form.twh} on={update("twh")} /></Row>
            <Row><Field label="Tubing ID (in)" v={form.tubingId} on={update("tubingId")} /><Field label="γ gas" v={form.gasSg} on={update("gasSg")} /></Row>
            <Row><Field label="ρ líquido (lb/ft³)" v={form.rhoL} on={update("rhoL")} /><Field label="σ (dyne/cm)" v={form.surfaceTension} on={update("surfaceTension")} /></Row>
            <div className="grid grid-cols-2 gap-2 rounded-md border border-border/40 bg-muted/30 p-2 text-xs">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">v_c Turner</p>
                <p className="font-mono font-bold">{fmt(ll.vcTurner, 2)} ft/s</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">v_c Coleman</p>
                <p className="font-mono font-bold">{fmt(ll.vcColeman, 2)} ft/s</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">q_c Turner</p>
                <p className="font-mono font-bold">{fmt(ll.qcTurnerMMscfd, 4)} MMscfd</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">q_c Coleman</p>
                <p className="font-mono font-bold">{fmt(ll.qcColemanMMscfd, 4)} MMscfd</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Erosional */}
        <Card className="anim-fade-in">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Wind className="h-4 w-4 text-primary" />
              Velocidad erosional (API RP 14E)
              <InfoTip content="v_e = c/√ρ. c=100 (continuo), c=125 (intermitente), c<100 si hay sólidos." />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Row><Field label="ρ mezcla (lb/ft³)" v={form.rhoMix} on={update("rhoMix")} /><Field label="v actual (ft/s)" v={form.velocity} on={update("velocity")} /></Row>
            <Row><Field label="c (100/125/...)" v={form.cFactor} on={update("cFactor")} /><Field label="ID (in)" v={form.tubingId} on={update("tubingId")} /></Row>
            <Alert
              variant={ev.status === "exceeded" ? "destructive" : ev.status === "warning" ? "warning" : "success"}
              aria-live="polite"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <AlertTitle className="text-xs">
                v_e = {fmt(ev.vErosional, 1)} ft/s · margen {fmt(ev.marginPct, 1)}%
              </AlertTitle>
              <AlertDescription className="font-mono text-[10px]">
                Caudal límite: {fmt(ev.qErosionalBpd, 0)} BPD · {fmt(ev.qErosionalMMscfd * 5.615, 4)} MMscfd
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Skin breakdown */}
        <Card className="anim-fade-in">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Wrench className="h-4 w-4 text-primary" />
              Desglose de skin compuesto
              <InfoTip content="Skin total = Hawkins (daño) + Partial (penetración parcial) + Perforation + Deviation. Cada componente se calcula con datos de completación." />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <Row><Field label="k formación (md)" v={form.kForm} on={update("kForm")} /><Field label="k dañado (md)" v={form.kDam} on={update("kDam")} /></Row>
            <Row><Field label="r dañado (ft)" v={form.rDam} on={update("rDam")} /><Field label="r pozo (ft)" v={form.rWell} on={update("rWell")} /></Row>
            <Row><Field label="h penetrado (ft)" v={form.hPen} on={update("hPen")} /><Field label="h reservorio (ft)" v={form.hRes} on={update("hRes")} /></Row>
            <Row><Field label="SPF" v={form.spf} on={update("spf")} /><Field label="L perf (in)" v={form.perfLen} on={update("perfLen")} /></Row>
            <Row><Field label="d perf (in)" v={form.perfDia} on={update("perfDia")} /><Field label="Inclinación (°)" v={form.inclination} on={update("inclination")} /></Row>
            <div className="grid grid-cols-5 gap-1 rounded-md border border-border/40 bg-muted/30 p-2 text-center">
              <SkinChip label="Hawkins" v={skinParts.hawkins} />
              <SkinChip label="Partial" v={skinParts.partial} />
              <SkinChip label="Perf" v={skinParts.perforation} />
              <SkinChip label="Deviation" v={skinParts.deviation} />
              <SkinChip label="Total" v={skinParts.total} bold />
            </div>
          </CardContent>
        </Card>

        {/* Hydrate */}
        <Card className="anim-fade-in">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Snowflake className="h-4 w-4 text-primary" />
              Predicción de hidratos
              <InfoTip content="Towler-Mokhatab: T_hyd vs P, γg. Hammerschmidt: depresión por inhibidor (metanol/MEG/DEG/TEG)." />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <Row>
              <Field label="P operación (psi)" v={form.pOper} on={update("pOper")} />
              <Field label="T operación (°F)" v={form.tOper} on={update("tOper")} />
            </Row>
            <Row>
              <div className="grid grid-cols-2 items-center gap-2">
                <Label className="text-xs">Inhibidor</Label>
                <Select value={form.inhibitor} onValueChange={(v) => update("inhibitor")(v as Inhibitor)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="methanol">Metanol</SelectItem>
                    <SelectItem value="MEG">MEG</SelectItem>
                    <SelectItem value="DEG">DEG</SelectItem>
                    <SelectItem value="TEG">TEG</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field label="X% en peso" v={form.inhibitorPct} on={update("inhibitorPct")} />
            </Row>
            <Alert
              variant={hyd.risk === "risk" ? "destructive" : hyd.risk === "watch" ? "warning" : "success"}
            >
              <Snowflake className="h-3.5 w-3.5" />
              <AlertTitle className="text-xs">
                T_hyd = {fmt(hyd.tHyd, 1)}°F · ΔT = {fmt(hyd.deltaT, 1)}°F
              </AlertTitle>
              <AlertDescription className="text-[10px]">
                {hyd.risk === "risk" ? "Operando dentro de la región de hidratos." : hyd.risk === "watch" ? "Cerca del envelope, monitorear." : "Operación segura."} Inhibidor: ΔT depresión = <span className="font-mono">{fmt(inhDeltaT, 1)}°F</span>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Sand prediction */}
        <Card className="anim-fade-in">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Layers className="h-4 w-4 text-primary" />
              Producción de arena
              <InfoTip content="ΔP_crit = 2·UCS·(1−2ν)/(1−ν). Si el drawdown actual lo excede, hay riesgo de movilización." />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Row><Field label="UCS (psi)" v={form.ucs} on={update("ucs")} /><Field label="Poisson ν" v={form.poisson} on={update("poisson")} /></Row>
            <Row><Field label="Drawdown actual (psi)" v={form.drawdown} on={update("drawdown")} /><div /></Row>
            <Alert variant={sand.status === "risk" ? "destructive" : sand.status === "watch" ? "warning" : "success"}>
              <AlertTriangle className="h-3.5 w-3.5" />
              <AlertTitle className="text-xs">
                ΔP_crit = {fmt(sand.drawdownCritical, 0)} psi · margen {fmt(sand.marginPsi, 0)} psi
              </AlertTitle>
            </Alert>
          </CardContent>
        </Card>

        {/* Choke */}
        <Card className="anim-fade-in">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Gauge className="h-4 w-4 text-primary" />
              Choke de superficie
              <InfoTip content="Pwh = a·R^b·Q / D^c. Gilbert/Ros/Baxendell/Achong. R = GLR (scf/STB), D = 1/64 in." />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Row>
              <div className="grid grid-cols-2 items-center gap-2">
                <Label className="text-xs">Correlación</Label>
                <Select value={chokeCorr} onValueChange={(v) => setChokeCorr(v as ChokeCorrelation)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gilbert">Gilbert</SelectItem>
                    <SelectItem value="ros">Ros</SelectItem>
                    <SelectItem value="baxendell">Baxendell</SelectItem>
                    <SelectItem value="achong">Achong</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field label="Q (STB/d)" v={form.qStb} on={update("qStb")} />
            </Row>
            <Row><Field label="GLR (scf/STB)" v={form.glr} on={update("glr")} /><div /></Row>
            <PetroleumChart
              series={chokeData}
              xLabel="Caudal Q (STB/d)"
              yLabel="Pwh (psi)"
              height={240}
            />
          </CardContent>
        </Card>
      </div>

      {/* ─────────────────── Optimizadores grandes ─────────────────── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card className="anim-slide-up">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4 text-primary" />
              Optimizador de tubing
              <InfoTip content="Barre los IDs estándar API y muestra el operating point para cada uno. El óptimo es el mayor q_op." />
            </CardTitle>
            <Button size="sm" onClick={runTubing}>
              <Calculator className="mr-1 h-3 w-3" />
              Ejecutar
            </Button>
          </CardHeader>
          <CardContent>
            {tubingResult ? (
              <>
                <PetroleumChart series={tubingSeries} markers={tubingMarkers} height={260} showBrush />
                {tubingOptimum && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <KpiCard label="ID óptimo" value={`${tubingOptimum.id}"`} tone="success" />
                    <KpiCard label="q* óptimo" value={fmt(tubingOptimum.qOp, 0)} unit="STB/d" />
                    <KpiCard label="Pwf*" value={fmt(tubingOptimum.pwfOp, 0)} unit="psi" />
                  </div>
                )}
                <p className="mt-2 text-[10px] italic text-muted-foreground">
                  IDs evaluados: {STANDARD_TUBING_IDS.join(", ")} in (API).
                </p>
              </>
            ) : (
              <div className="flex h-60 items-center justify-center rounded-lg border border-dashed border-primary/30 text-sm text-muted-foreground">
                Ejecuta el barrido de tubing.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="anim-slide-up">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4 text-primary" />
              Performance de gas lift
              <InfoTip content="Barre la GLR de inyección y encuentra el q_op para cada valor. La curva tiene un máximo (óptimo de inyección)." />
            </CardTitle>
            <Button size="sm" onClick={runGasLift}>
              <Calculator className="mr-1 h-3 w-3" />
              Ejecutar
            </Button>
          </CardHeader>
          <CardContent>
            <Row>
              <Field label="GLR_inj desde (scf/STB)" v={form.glrInjFrom} on={update("glrInjFrom")} />
              <Field label="GLR_inj hasta" v={form.glrInjTo} on={update("glrInjTo")} />
            </Row>
            {gasLiftResult ? (
              <>
                <PetroleumChart
                  series={[{
                    name: "q_op vs GLR_inj",
                    color: "#3498DB",
                    points: gasLiftResult.map((p) => ({ q: p.glrInj, pwf: p.qOp })),
                  }]}
                  xLabel="GLR inyección (scf/STB)"
                  yLabel="q operación (STB/d)"
                  height={240}
                  markers={gasLiftOptimum ? [{
                    q: gasLiftOptimum.glrInj,
                    pwf: gasLiftOptimum.qOp,
                    label: "Óptimo",
                    color: "#E74C3C",
                  }] : []}
                />
                {gasLiftOptimum && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <KpiCard label="GLR_inj óptimo" value={fmt(gasLiftOptimum.glrInj, 0)} unit="scf/STB" tone="success" />
                    <KpiCard label="q óptimo" value={fmt(gasLiftOptimum.qOp, 0)} unit="STB/d" />
                    <KpiCard label="Pwf" value={fmt(gasLiftOptimum.pwfOp, 0)} unit="psi" />
                  </div>
                )}
              </>
            ) : (
              <div className="mt-3 flex h-60 items-center justify-center rounded-lg border border-dashed border-primary/30 text-sm text-muted-foreground">
                Ejecuta el barrido de gas lift.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-[10px] italic text-muted-foreground">
        Calculadoras pedagógicas — para diseño definitivo, valida con software comercial (PIPESIM, Prosper) y datos de campo. <Badge variant="outline">{fluid.toUpperCase()}</Badge>
      </p>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

function Field({ label, v, on }: { label: string; v: string; on: (s: string) => void }) {
  return (
    <div className="grid grid-cols-2 items-center gap-2">
      <Label className="text-xs">{label}</Label>
      <Input type="number" step="any" value={v} onChange={(e) => on(e.target.value)} />
    </div>
  );
}

function SkinChip({ label, v, bold }: { label: string; v: number; bold?: boolean }) {
  const tone = v > 5 ? "text-destructive" : v < 0 ? "text-emerald-700 dark:text-emerald-300" : "text-foreground";
  return (
    <div>
      <p className="text-[9px] uppercase text-muted-foreground">{label}</p>
      <p className={`font-mono ${bold ? "text-base font-bold" : "text-sm"} ${tone}`}>
        {fmt(v, 2)}
      </p>
    </div>
  );
}
