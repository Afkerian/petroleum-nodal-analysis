/**
 * Optimizador de tamaño de tubing. Para un set de IDs estándar (1.995", 2.375",
 * 2.875", 3.5", 4.5") corre el VLP completo y encuentra el punto de
 * operación. El óptimo suele ser un trade-off entre fricción (favor a IDs
 * grandes) y efecto de fondo / liquid loading (favor a IDs pequeños).
 */
import { calculatePwf31, type VLPInput } from "./vlp-models";
import { findOperatingPoint } from "./nodal";

export const STANDARD_TUBING_IDS = [1.610, 1.995, 2.441, 2.992, 3.476, 3.958] as const;

export interface TubingResult {
  id: number;
  qOp: number;
  pwfOp: number;
  vlp: { q: number; pwf: number }[];
}

export function sweepTubing(
  baseVLP: Omit<VLPInput, "qLiqBpd" | "tubingIdIn">,
  qMax: number,
  ipr: { q: number; pwf: number }[],
  ids: readonly number[] = STANDARD_TUBING_IDS
): TubingResult[] {
  const out: TubingResult[] = [];
  const qS = Math.max(50, qMax * 0.05);
  const nQ = 16;
  const qStep = (qMax - qS) / (nQ - 1);
  for (const id of ids) {
    const vlp: { q: number; pwf: number }[] = [];
    for (let i = 0; i < nQ; i++) {
      const q = qS + qStep * i;
      const r = calculatePwf31({ ...baseVLP, tubingIdIn: id, qLiqBpd: q });
      vlp.push({ q, pwf: r.pwf });
    }
    const op = findOperatingPoint(ipr, vlp);
    out.push({ id, qOp: op?.q ?? 0, pwfOp: op?.pwf ?? 0, vlp });
  }
  return out;
}
