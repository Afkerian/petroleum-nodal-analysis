import { useMemo } from "react";
import { FlaskConical } from "lucide-react";
import {
  PVT,
  pickBo,
  pickPb,
  pickRs,
  pickZ,
  type BoCorrelation,
  type PbCorrelation,
  type ZCorrelation,
} from "@/lib/pvt-correlations";
import { useLocalStorage } from "@/lib/use-local-storage";
import { useTranslation } from "@/lib/i18n";
import { fmt } from "@/lib/utils";
import { PetroleumChart, type ChartSeries } from "./petroleum-chart";
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

interface PvtForm {
  api: string;
  gammaG: string;
  tempF: string;
  pMin: string;
  pMax: string;
  rs: string;
  pbCorr: PbCorrelation;
  boCorr: BoCorrelation;
  zCorr: ZCorrelation;
}

const DEFAULTS: PvtForm = {
  api: "30",
  gammaG: "0.75",
  tempF: "180",
  pMin: "100",
  pMax: "5000",
  rs: "600",
  pbCorr: "standing",
  boCorr: "standing",
  zCorr: "dak",
};

const num = (s: string) => {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
};

export function PvtExplorerTab() {
  const { t } = useTranslation();
  const [form, setForm] = useLocalStorage<PvtForm>("pvt-form", DEFAULTS);
  const update = <K extends keyof PvtForm>(key: K) => (v: PvtForm[K]) =>
    setForm((s) => ({ ...s, [key]: v }));

  const computed = useMemo(() => {
    const api = num(form.api);
    const gammaG = num(form.gammaG);
    const tempF = num(form.tempF);
    const rs = num(form.rs);
    const pMin = Math.max(14.7, num(form.pMin));
    const pMax = Math.max(pMin + 100, num(form.pMax));
    const N = 80;
    const pPc = 756.8 - 131.0 * gammaG;
    const tPc = 169.2 + 349.5 * gammaG;

    const rsArr: { q: number; pwf: number }[] = [];
    const boArr: { q: number; pwf: number }[] = [];
    const zArr: { q: number; pwf: number }[] = [];
    const muOilArr: { q: number; pwf: number }[] = [];

    let pbAt = 0;
    for (let i = 0; i < N; i++) {
      const p = pMin + ((pMax - pMin) * i) / (N - 1);
      const pb = pickPb(form.pbCorr, rs, gammaG, api, tempF);
      pbAt = pb;
      const rsAtP = p < pb ? pickRs(form.boCorr, p, gammaG, api, tempF) : rs;
      const boAtP = pickBo(form.boCorr, rsAtP, gammaG, api, tempF);
      const ppr = p / pPc;
      const tpr = (tempF + 460) / tPc;
      const z = pickZ(form.zCorr, ppr, tpr);
      const muO = PVT.muOilBeggsRobinson(api, tempF, rsAtP, p, pb);

      rsArr.push({ q: p, pwf: rsAtP });
      boArr.push({ q: p, pwf: boAtP });
      zArr.push({ q: p, pwf: z });
      muOilArr.push({ q: p, pwf: muO });
    }
    return { rsArr, boArr, zArr, muOilArr, pb: pbAt };
  }, [form]);

  const seriesRsBo: ChartSeries[] = [
    { name: "Rs (scf/STB)", color: "#E74C3C", points: computed.rsArr },
  ];
  const seriesBo: ChartSeries[] = [
    { name: "Bo (rb/STB)", color: "#3498DB", points: computed.boArr },
  ];
  const seriesZ: ChartSeries[] = [
    { name: "Z (–)", color: "#16A085", points: computed.zArr },
  ];
  const seriesMu: ChartSeries[] = [
    { name: "μ_o (cp)", color: "#9B59B6", points: computed.muOilArr },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
      <Card className="anim-fade-in">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            Explorador PVT
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="API" v={form.api} on={update("api")} />
          <Field label="Gravedad gas γg" v={form.gammaG} on={update("gammaG")} />
          <Field label="Temperatura (°F)" v={form.tempF} on={update("tempF")} />
          <Field label="Rs deseado a Pb (scf/STB)" v={form.rs} on={update("rs")} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="P min (psi)" v={form.pMin} on={update("pMin")} />
            <Field label="P max (psi)" v={form.pMax} on={update("pMax")} />
          </div>

          <Pick label="Correlación Pb" value={form.pbCorr} onChange={update("pbCorr")} options={[
            ["standing", "Standing"],
            ["lasater", "Lasater"],
            ["glaso", "Glaso"],
            ["vazquez-beggs", "Vazquez-Beggs"],
          ]} />
          <Pick label="Correlación Rs/Bo" value={form.boCorr} onChange={update("boCorr")} options={[
            ["standing", "Standing"],
            ["vazquez-beggs", "Vazquez-Beggs"],
          ]} />
          <Pick label="Correlación Z" value={form.zCorr} onChange={update("zCorr")} options={[
            ["dak", "DAK"],
            ["hall-yarborough", "Hall-Yarborough"],
          ]} />
          <p className="rounded-md border border-primary/20 bg-primary/5 p-2 text-xs">
            Pb estimada: <span className="font-mono font-semibold">{fmt(computed.pb, 1)} psi</span>
          </p>
          <p className="text-xs italic text-muted-foreground">{t("common.parameters")} se actualizan en vivo.</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <ChartCard title="Rs vs P" series={seriesRsBo} xLabel="P (psi)" yLabel="Rs (scf/STB)" pb={computed.pb} />
        <ChartCard title="Bo vs P" series={seriesBo} xLabel="P (psi)" yLabel="Bo (rb/STB)" pb={computed.pb} />
        <ChartCard title="Z vs P" series={seriesZ} xLabel="P (psi)" yLabel="Z" pb={computed.pb} />
        <ChartCard title="μ_o vs P" series={seriesMu} xLabel="P (psi)" yLabel="μ_o (cp)" pb={computed.pb} />
      </div>
    </div>
  );
}

function ChartCard({
  title,
  series,
  xLabel,
  yLabel,
  pb,
}: {
  title: string;
  series: ChartSeries[];
  xLabel: string;
  yLabel: string;
  pb: number;
}) {
  return (
    <Card className="anim-slide-up">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <PetroleumChart
          series={series}
          xLabel={xLabel}
          yLabel={yLabel}
          referenceLines={pb > 0 ? [{ axis: "x", value: pb, label: "Pb", color: "#8A56AC" }] : []}
          height={260}
        />
      </CardContent>
    </Card>
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

function Pick<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: Array<[T, string]>;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([k, l]) => (
            <SelectItem key={k} value={k}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
