/**
 * i18n minimalista — sin librería externa. Provee `useTranslation()` con
 * un diccionario en memoria y persistencia del locale en localStorage.
 */
import { createContext, useContext, useEffect, useState, type ReactNode, createElement } from "react";

export type Locale = "es" | "en";

const dict = {
  es: {
    "app.title": "VIOLET — Petroleum Production System",
    "app.subtitle": "Análisis Nodal · Curvas IPR / VLP · Correlaciones PVT",
    "app.version": "v2.0 · React + TypeScript",
    "app.footer.models": "Modelos: Vogel · Fetkovich · Wiggins · Darcy · Joshi · Compuesto.",
    "app.footer.pvt": "PVT: Standing · Lasater · Glaso · Vazquez-Beggs · DAK · Hall-Yarborough · Beggs-Robinson · Lee.",
    "tabs.ipr": "Curvas IPR",
    "tabs.vlp": "VLP & Análisis Nodal",
    "tabs.sensitivity": "Sensibilidad",
    "tabs.pvt": "Explorador PVT",
    "tabs.compare": "Comparación",
    "common.calculate": "Calcular",
    "common.export.csv": "Exportar CSV",
    "common.reset": "Reset",
    "common.loading": "Calculando…",
    "common.fluid": "Fluido",
    "common.oil": "Petróleo",
    "common.gas": "Gas",
    "common.model": "Modelo",
    "common.parameters": "Parámetros",
    "common.results": "Resultados",
    "common.start": "Comenzar",
    "common.scale.linear": "Lineal",
    "common.scale.log": "Log-Log",
    "ipr.title": "Análisis IPR",
    "ipr.curve": "Curva IPR",
    "ipr.table": "Tabla de Resultados (Pwf vs Q)",
    "ipr.aof": "AOF (Pwf = 0)",
    "ipr.compare.add": "Superponer modelo",
    "ipr.compare.clear": "Limpiar comparación",
    "vlp.title": "Análisis Nodal — Datos de Entrada",
    "vlp.section.geometry": "Geometría del Pozo",
    "vlp.section.production": "Datos de Producción",
    "vlp.section.ipr": "Datos IPR (Intersección)",
    "vlp.calc": "Calcular Análisis Nodal (31 Pasos)",
    "vlp.chart.title": "Análisis Nodal (VLP vs IPR)",
    "vlp.steps.title": "Variables del Último Punto VLP (31 Pasos)",
    "vlp.converged": "Convergencia alcanzada",
    "vlp.notConverged": "Sin convergencia plena",
    "vlp.operating": "Punto de operación",
    "sens.title": "Análisis de Sensibilidad",
    "sens.parameter": "Parámetro a barrer",
    "sens.from": "Desde",
    "sens.to": "Hasta",
    "sens.steps": "Pasos",
    "sens.run": "Ejecutar barrido",
    "warn.title": "Advertencias",
    "splash.subtitle": "Análisis nodal de pozos petroleros",
    "splash.start": "Iniciar análisis",
    "theme.toggle": "Alternar tema",
    "lang.label": "Idioma",
    "step": "Paso",
    "step.geom": "Geometría",
    "step.prod": "Producción",
    "step.ipr": "IPR",
    "step.next": "Siguiente",
    "step.prev": "Atrás",
  },
  en: {
    "app.title": "VIOLET — Petroleum Production System",
    "app.subtitle": "Nodal Analysis · IPR / VLP Curves · PVT Correlations",
    "app.version": "v2.0 · React + TypeScript",
    "app.footer.models": "Models: Vogel · Fetkovich · Wiggins · Darcy · Joshi · Composite.",
    "app.footer.pvt": "PVT: Standing · Lasater · Glaso · Vazquez-Beggs · DAK · Hall-Yarborough · Beggs-Robinson · Lee.",
    "tabs.ipr": "IPR Curves",
    "tabs.vlp": "VLP & Nodal Analysis",
    "tabs.sensitivity": "Sensitivity",
    "tabs.pvt": "PVT Explorer",
    "tabs.compare": "Compare",
    "common.calculate": "Calculate",
    "common.export.csv": "Export CSV",
    "common.reset": "Reset",
    "common.loading": "Computing…",
    "common.fluid": "Fluid",
    "common.oil": "Oil",
    "common.gas": "Gas",
    "common.model": "Model",
    "common.parameters": "Parameters",
    "common.results": "Results",
    "common.start": "Start",
    "common.scale.linear": "Linear",
    "common.scale.log": "Log-Log",
    "ipr.title": "IPR Analysis",
    "ipr.curve": "IPR Curve",
    "ipr.table": "Results (Pwf vs Q)",
    "ipr.aof": "AOF (Pwf = 0)",
    "ipr.compare.add": "Overlay model",
    "ipr.compare.clear": "Clear overlay",
    "vlp.title": "Nodal Analysis — Inputs",
    "vlp.section.geometry": "Well Geometry",
    "vlp.section.production": "Production Data",
    "vlp.section.ipr": "IPR Data (Intersection)",
    "vlp.calc": "Run Nodal Analysis (31 Steps)",
    "vlp.chart.title": "Nodal Analysis (VLP vs IPR)",
    "vlp.steps.title": "Last VLP Point Variables (31 Steps)",
    "vlp.converged": "Converged",
    "vlp.notConverged": "Did not fully converge",
    "vlp.operating": "Operating point",
    "sens.title": "Sensitivity Analysis",
    "sens.parameter": "Parameter to sweep",
    "sens.from": "From",
    "sens.to": "To",
    "sens.steps": "Steps",
    "sens.run": "Run sweep",
    "warn.title": "Warnings",
    "splash.subtitle": "Nodal analysis of oil wells",
    "splash.start": "Begin analysis",
    "theme.toggle": "Toggle theme",
    "lang.label": "Language",
    "step": "Step",
    "step.geom": "Geometry",
    "step.prod": "Production",
    "step.ipr": "IPR",
    "step.next": "Next",
    "step.prev": "Back",
  },
} as const;

export type TKey = keyof typeof dict.es;

interface I18nCtx {
  locale: Locale;
  t: (k: TKey) => string;
  setLocale: (l: Locale) => void;
}

const Ctx = createContext<I18nCtx>({
  locale: "es",
  t: (k) => dict.es[k] ?? k,
  setLocale: () => {},
});

const STORAGE_KEY = "violet-locale";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") return "es";
    const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
    return stored === "es" || stored === "en" ? stored : "es";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, locale);
      document.documentElement.lang = locale;
      // Mantener `translate="no"` aunque cambie el lang — evita que Chrome
      // Translate intervenga el DOM y rompa React (removeChild bug clásico).
      document.documentElement.setAttribute("translate", "no");
    }
  }, [locale]);

  const t = (k: TKey): string => dict[locale][k] ?? dict.es[k] ?? k;
  return createElement(Ctx.Provider, { value: { locale, t, setLocale: setLocaleState } }, children);
}

export function useTranslation() {
  return useContext(Ctx);
}
