/**
 * Optimización de gas lift continuo. Barre la GLR de inyección, calcula la
 * curva VLP resultante y encuentra el punto de operación con la IPR para
 * cada GLR. La curva Q_op vs GLR_inj tiene un máximo (la "curva de
 * performance del gas lift"). Más allá del óptimo, el gas extra aumenta la
 * fricción y reduce el caudal.
 */
import { calculatePwf31, type VLPInput } from "./vlp-models";
import { findOperatingPoint } from "./nodal";

export interface GasLiftInput {
  baseVLP: Omit<VLPInput, "qLiqBpd" | "gor">;
  formationGor: number;       // GOR del yacimiento
  injectionGlrRange: [number, number]; // scf/STB inyectado
  steps: number;
  ipr: { q: number; pwf: number }[];
  qMax: number;
  qStart?: number;
}

export interface GasLiftPoint {
  glrInj: number;          // scf/STB inyectado
  glrTotal: number;        // GOR formación + inyección
  qOp: number;             // STB/d obtenido
  pwfOp: number;
}

export function gasLiftSweep(input: GasLiftInput): GasLiftPoint[] {
  const { baseVLP, formationGor, injectionGlrRange, steps, ipr, qMax, qStart } = input;
  const [from, to] = injectionGlrRange;
  const out: GasLiftPoint[] = [];
  const qS = qStart ?? Math.max(50, qMax * 0.05);
  const nQ = 16;
  const qStep = (qMax - qS) / (nQ - 1);
  for (let s = 0; s < steps; s++) {
    const glrInj = from + ((to - from) * s) / Math.max(1, steps - 1);
    const glrTotal = formationGor + glrInj;
    const vlp: { q: number; pwf: number }[] = [];
    for (let i = 0; i < nQ; i++) {
      const q = qS + qStep * i;
      const r = calculatePwf31({ ...baseVLP, gor: glrTotal, qLiqBpd: q });
      vlp.push({ q, pwf: r.pwf });
    }
    const op = findOperatingPoint(ipr, vlp);
    out.push({
      glrInj,
      glrTotal,
      qOp: op?.q ?? 0,
      pwfOp: op?.pwf ?? 0,
    });
  }
  return out;
}
