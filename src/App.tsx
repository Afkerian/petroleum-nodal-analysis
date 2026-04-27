import { Suspense, lazy, useState } from "react";
import {
  Beaker,
  Droplet,
  FlaskConical,
  GitCompareArrows,
  Grid3x3,
  Languages,
  Moon,
  Printer,
  Sliders,
  Sun,
  TrendingDown,
  TrendingUp,
  Wind,
  Wrench,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorBoundary } from "@/components/error-boundary";
import { SplashScreen } from "@/components/splash-screen";
import { CommandPalette, type CommandAction } from "@/components/command-palette";
import { ToastViewport } from "@/components/toast-viewport";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n";
import { useLocalStorage } from "@/lib/use-local-storage";
import { useFluid } from "@/lib/fluid";
import { toast } from "@/lib/toast";

const IPRTab = lazy(() => import("@/components/ipr-tab").then((m) => ({ default: m.IPRTab })));
const VLPTab = lazy(() => import("@/components/vlp-tab").then((m) => ({ default: m.VLPTab })));
const SensitivityTab = lazy(() =>
  import("@/components/sensitivity-tab").then((m) => ({ default: m.SensitivityTab }))
);
const Sensitivity2DTab = lazy(() =>
  import("@/components/sensitivity-2d-tab").then((m) => ({ default: m.Sensitivity2DTab }))
);
const PvtExplorerTab = lazy(() =>
  import("@/components/pvt-explorer-tab").then((m) => ({ default: m.PvtExplorerTab }))
);
const CompareTab = lazy(() =>
  import("@/components/compare-tab").then((m) => ({ default: m.CompareTab }))
);
const ProductionEngineeringTab = lazy(() =>
  import("@/components/production-engineering-tab").then((m) => ({ default: m.ProductionEngineeringTab }))
);
const DeclineTab = lazy(() =>
  import("@/components/decline-tab").then((m) => ({ default: m.DeclineTab }))
);
const MaterialBalanceTab = lazy(() =>
  import("@/components/material-balance-tab").then((m) => ({ default: m.MaterialBalanceTab }))
);

function TabFallback() {
  return (
    <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
      Cargando módulo…
    </div>
  );
}

const YEAR = new Date().getFullYear();

export default function App() {
  const { t, locale, setLocale } = useTranslation();
  const { fluid, setFluid } = useFluid();
  const [theme, setTheme] = useTheme();
  const [splashSeen, setSplashSeen] = useLocalStorage<boolean>("splash-seen", false);
  const [tab, setTab] = useState<string>("ipr");

  const commands: CommandAction[] = [
    { id: "go-ipr", label: "Ir a IPR", group: "Navegación", run: () => setTab("ipr") },
    { id: "go-vlp", label: "Ir a VLP / Análisis Nodal", group: "Navegación", run: () => setTab("vlp") },
    { id: "go-sens", label: "Ir a Sensibilidad", group: "Navegación", run: () => setTab("sens") },
    { id: "go-sens2d", label: "Ir a Sensibilidad 2D (heatmap)", group: "Navegación", run: () => setTab("sens2d") },
    { id: "go-pvt", label: "Ir a Explorador PVT", group: "Navegación", run: () => setTab("pvt") },
    { id: "go-cmp", label: "Ir a Comparación", group: "Navegación", run: () => setTab("cmp") },
    { id: "go-pe", label: "Ir a Producción (Turner/Choke/Skin/...)", group: "Navegación", run: () => setTab("pe") },
    { id: "go-decline", label: "Ir a Declinación (Arps)", group: "Navegación", run: () => setTab("decline") },
    { id: "go-mb", label: "Ir a Material Balance", group: "Navegación", run: () => setTab("mb") },
    { id: "fluid-oil", label: "Cambiar a Petróleo (oil)", group: "Fluido", run: () => setFluid("oil") },
    { id: "fluid-gas", label: "Cambiar a Gas", group: "Fluido", run: () => setFluid("gas") },
    { id: "theme", label: "Alternar tema (light/dark)", group: "Vista", shortcut: "T", run: () => setTheme(theme === "dark" ? "light" : "dark") },
    { id: "lang", label: "Alternar idioma ES/EN", group: "Vista", run: () => setLocale(locale === "es" ? "en" : "es") },
    { id: "print", label: "Imprimir / Exportar PDF", group: "Acción", shortcut: "Ctrl+P", run: () => window.print() },
    { id: "reset-splash", label: "Volver a ver el splash", group: "Acción", run: () => { setSplashSeen(false); toast.info("Splash restablecido"); } },
  ];

  if (!splashSeen) {
    return (
      <>
        <SplashScreen onStart={() => setSplashSeen(true)} />
        <ToastViewport />
      </>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="bg-primary text-primary-foreground shadow no-print">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-white/15">
              <Droplet className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-bold tracking-wide">{t("app.title")}</h1>
              <p className="text-xs text-primary-foreground/70">{t("app.subtitle")}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-xs"
              role="group"
              aria-label={t("common.fluid")}
            >
              {fluid === "oil" ? (
                <Droplet className="h-3.5 w-3.5" />
              ) : (
                <Wind className="h-3.5 w-3.5" />
              )}
              <Select value={fluid} onValueChange={(v) => setFluid(v as "oil" | "gas")}>
                <SelectTrigger className="h-7 w-28 border-0 bg-transparent text-xs uppercase tracking-wide text-primary-foreground hover:bg-white/10 focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="oil">{t("common.oil")}</SelectItem>
                  <SelectItem value="gas">{t("common.gas")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground hover:bg-white/15"
              onClick={() => window.print()}
              aria-label="Imprimir / PDF"
              title="Imprimir / Guardar como PDF (Ctrl+P)"
            >
              <Printer className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground hover:bg-white/15"
              onClick={() => setLocale(locale === "es" ? "en" : "es")}
              aria-label={t("lang.label")}
              title={`${t("lang.label")}: ${locale.toUpperCase()}`}
            >
              <Languages className="h-4 w-4" />
              <span className="ml-1 text-xs uppercase">{locale}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground hover:bg-white/15"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={t("theme.toggle")}
              title={t("theme.toggle")}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <kbd className="hidden rounded border border-primary-foreground/30 bg-white/10 px-1.5 py-0.5 text-[10px] font-mono uppercase text-primary-foreground/80 lg:inline-block">
              Ctrl+K
            </kbd>
            <span className="hidden text-xs uppercase tracking-widest text-primary-foreground/70 lg:block">
              v3.0
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4 flex h-auto w-full flex-wrap gap-1 no-print">
            <TabsTrigger value="ipr" className="gap-2">
              <TrendingUp className="h-3.5 w-3.5" />
              {t("tabs.ipr")}
            </TabsTrigger>
            <TabsTrigger value="vlp" className="gap-2">
              <Wind className="h-3.5 w-3.5" />
              {t("tabs.vlp")}
            </TabsTrigger>
            <TabsTrigger value="sens" className="gap-2">
              <Sliders className="h-3.5 w-3.5" />
              {t("tabs.sensitivity")}
            </TabsTrigger>
            <TabsTrigger value="sens2d" className="gap-2">
              <Grid3x3 className="h-3.5 w-3.5" />
              Sens. 2D
            </TabsTrigger>
            <TabsTrigger value="pvt" className="gap-2">
              <FlaskConical className="h-3.5 w-3.5" />
              {t("tabs.pvt")}
            </TabsTrigger>
            <TabsTrigger value="cmp" className="gap-2">
              <GitCompareArrows className="h-3.5 w-3.5" />
              {t("tabs.compare")}
            </TabsTrigger>
            <TabsTrigger value="pe" className="gap-2">
              <Wrench className="h-3.5 w-3.5" />
              Producción
            </TabsTrigger>
            <TabsTrigger value="decline" className="gap-2">
              <TrendingDown className="h-3.5 w-3.5" />
              Declinación
            </TabsTrigger>
            <TabsTrigger value="mb" className="gap-2">
              <Beaker className="h-3.5 w-3.5" />
              Material Balance
            </TabsTrigger>
          </TabsList>
          <ErrorBoundary>
            <Suspense fallback={<TabFallback />}>
              <TabsContent value="ipr"><IPRTab /></TabsContent>
              <TabsContent value="vlp"><VLPTab /></TabsContent>
              <TabsContent value="sens"><SensitivityTab /></TabsContent>
              <TabsContent value="sens2d"><Sensitivity2DTab /></TabsContent>
              <TabsContent value="pvt"><PvtExplorerTab /></TabsContent>
              <TabsContent value="cmp"><CompareTab /></TabsContent>
              <TabsContent value="pe"><ProductionEngineeringTab /></TabsContent>
              <TabsContent value="decline"><DeclineTab /></TabsContent>
              <TabsContent value="mb"><MaterialBalanceTab /></TabsContent>
            </Suspense>
          </ErrorBoundary>
        </Tabs>
      </main>

      <footer className="mx-auto mt-6 max-w-7xl border-t border-border/40 px-6 py-6 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p>{t("app.footer.models")}</p>
            <p>{t("app.footer.pvt")}</p>
          </div>
          <p className="font-medium text-foreground/70">
            © {YEAR} · Elaborado por <span className="font-semibold text-primary">Tania Rosillo</span>
          </p>
        </div>
      </footer>

      <CommandPalette actions={commands} />
      <ToastViewport />
    </div>
  );
}
