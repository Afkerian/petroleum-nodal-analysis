/**
 * Predicción de producción de arena — drawdown crítico.
 *
 * Modelo simplificado basado en Hall (1953) + Tixier (mecánico):
 * la arena se moviliza cuando el gradiente local supera la cohesión efectiva
 * de la roca, función del módulo de Young y la porosidad.
 *
 *   ΔP_crit ≈ (2·Co·(1 − 2ν)) / (1 − ν)
 *
 * Donde Co es la resistencia a compresión uniaxial (UCS, psi) y ν el ratio
 * de Poisson de la formación. Para arenas no consolidadas Co ~ 100-500 psi.
 */

export interface SandInput {
  ucsPsi: number;        // resistencia uniaxial a compresión
  poisson: number;       // 0.15..0.35
  drawdownPsi: number;   // ΔP actual operativo
}

export interface SandResult {
  drawdownCritical: number;
  marginPsi: number;
  status: "safe" | "watch" | "risk";
}

export function sandPrediction({ ucsPsi, poisson, drawdownPsi }: SandInput): SandResult {
  const nu = Math.min(0.45, Math.max(0.05, poisson));
  const dpCrit = (2 * ucsPsi * (1 - 2 * nu)) / (1 - nu);
  const margin = dpCrit - drawdownPsi;
  let status: "safe" | "watch" | "risk";
  if (margin > 0.3 * dpCrit) status = "safe";
  else if (margin > 0) status = "watch";
  else status = "risk";
  return { drawdownCritical: dpCrit, marginPsi: margin, status };
}
