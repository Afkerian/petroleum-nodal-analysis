/**
 * Validación de rangos físicamente razonables. Emite warnings (no bloqueantes)
 * cuando algún input cae fuera del rango esperado por las correlaciones.
 *
 * Rangos basados en el PDF del curso y en Brill & Mukherjee.
 */

export type Severity = "warn" | "error";

export interface Issue {
  field: string;
  message: string;
  severity: Severity;
}

interface RangeRule {
  field: string;
  label: string;
  min?: number;
  max?: number;
  severity?: Severity;
  custom?: (value: number, all: Record<string, number>) => string | null;
}

const RULES: RangeRule[] = [
  { field: "api", label: "API", min: 5, max: 60 },
  { field: "bsw", label: "BSW", min: 0, max: 100 },
  { field: "gor", label: "GOR", min: 0 },
  { field: "tid", label: "Tubing ID", min: 0.5, max: 10 },
  { field: "depth", label: "Profundidad", min: 100, max: 30000 },
  { field: "pwh", label: "Presión cabeza", min: 14.7 },
  { field: "pres", label: "Presión yacimiento", min: 14.7 },
  { field: "qmax", label: "Q max", min: 1 },
  { field: "twh", label: "T cabeza", min: 32, max: 400 },
  { field: "tbh", label: "T fondo", min: 32, max: 500 },
  { field: "gsg", label: "Gravedad gas", min: 0.55, max: 1.6 },
  { field: "wsg", label: "Gravedad agua", min: 0.95, max: 1.3 },
  { field: "n", label: "Exponente n (gas)", min: 0.5, max: 1.0 },
  {
    field: "tbh",
    label: "T fondo",
    custom: (tbh, all) =>
      Number.isFinite(all.twh) && tbh <= all.twh
        ? "T_fondo debe ser mayor que T_cabeza (físicamente raro)"
        : null,
  },
  {
    field: "pres",
    label: "Presión yacimiento",
    custom: (pres, all) =>
      Number.isFinite(all.pwh) && pres <= all.pwh
        ? "Presión yacimiento debe superar la presión de cabeza"
        : null,
  },
];

export function validateInputs(values: Record<string, number>): Issue[] {
  const issues: Issue[] = [];
  for (const rule of RULES) {
    const v = values[rule.field];
    if (v === undefined || !Number.isFinite(v)) continue;

    if (rule.custom) {
      const msg = rule.custom(v, values);
      if (msg) issues.push({ field: rule.field, message: msg, severity: rule.severity ?? "warn" });
      continue;
    }
    if (rule.min !== undefined && v < rule.min) {
      issues.push({
        field: rule.field,
        message: `${rule.label} = ${v} está por debajo del mínimo recomendado (${rule.min}).`,
        severity: rule.severity ?? "warn",
      });
    }
    if (rule.max !== undefined && v > rule.max) {
      issues.push({
        field: rule.field,
        message: `${rule.label} = ${v} excede el máximo recomendado (${rule.max}).`,
        severity: rule.severity ?? "warn",
      });
    }
  }
  return issues;
}
