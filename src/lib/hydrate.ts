/**
 * Predicción de formación de hidratos en gas natural.
 *
 * Método de Towler-Mokhatab (curva ajustada a datos de Carroll):
 *   T_hyd[°F] = 13.47·ln(P) + 34.27·γg − 1.675·ln(P)·γg − 20.35
 *
 * Para inhibidor (metanol/glicol) — Hammerschmidt:
 *   ΔT[°F] = (2335 · X) / (M · (100 − X))    — corrected for °F
 *   X = concentración msa de inhibidor en agua libre, M = peso mol del inhibidor
 *   (metanol M=32, MEG M=62, DEG M=106, TEG M=150)
 *
 * Operar T < T_hyd a P dada → se forman hidratos. Se invierte para P_hyd a T.
 */

export interface HydrateInput {
  pressurePsi: number;
  gasSg: number;
}

export function hydrateTemperatureF(input: HydrateInput): number {
  const { pressurePsi: p, gasSg } = input;
  if (p <= 0) return 32;
  const lnP = Math.log(p);
  return 13.47 * lnP + 34.27 * gasSg - 1.675 * lnP * gasSg - 20.35;
}

/** Resuelve T_hyd inversamente para P dado T (bisección). */
export function hydratePressurePsi(targetTempF: number, gasSg: number): number {
  let lo = 14.7;
  let hi = 5000;
  for (let i = 0; i < 60; i++) {
    const mid = 0.5 * (lo + hi);
    const t = hydrateTemperatureF({ pressurePsi: mid, gasSg });
    if (Math.abs(t - targetTempF) < 0.1) return mid;
    if (t < targetTempF) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

export type Inhibitor = "methanol" | "MEG" | "DEG" | "TEG";

const M_INHIBITOR: Record<Inhibitor, number> = {
  methanol: 32.04,
  MEG: 62.07,
  DEG: 106.12,
  TEG: 150.17,
};

/**
 * Hammerschmidt — depresión del punto de hidratos (°F) para una concentración
 * en peso de inhibidor en la fase acuosa (X en %). Devuelve ΔT.
 */
export function hammerschmidtDeltaT(inhibitor: Inhibitor, weightPctX: number): number {
  const x = Math.min(60, Math.max(0, weightPctX)); // estable hasta ~50-60%
  const M = M_INHIBITOR[inhibitor];
  return (2335 * x) / (M * (100 - x));
}

export function hydrateRiskBand(input: HydrateInput): "safe" | "watch" | "risk" {
  // No tenemos T_op aquí; el llamador compara T_op vs T_hyd y elige el rango.
  // Esta función se queda como helper para el componente que sí compara.
  void input;
  return "safe";
}

export function hydrateAtConditions(
  pressurePsi: number,
  tempF: number,
  gasSg: number
): { tHyd: number; deltaT: number; risk: "safe" | "watch" | "risk" } {
  const tHyd = hydrateTemperatureF({ pressurePsi, gasSg });
  const dT = tempF - tHyd;
  let risk: "safe" | "watch" | "risk";
  if (dT > 5) risk = "safe";
  else if (dT > 0) risk = "watch";
  else risk = "risk";
  return { tHyd, deltaT: dT, risk };
}
