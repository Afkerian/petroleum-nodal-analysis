/**
 * Análisis de sensibilidad 2D — heatmap. Barre dos parámetros simultáneamente
 * y devuelve una matriz de valores objetivo (q_op por defecto). Útil para
 * identificar regiones óptimas / interacciones entre variables.
 */
import { calculatePwf31, type VLPInput } from "./vlp-models";
import { findOperatingPoint } from "./nodal";

export interface Sens2DInput {
  baseVLP: Omit<VLPInput, "qLiqBpd">;
  paramA: keyof VLPInput;
  paramB: keyof VLPInput;
  rangeA: [number, number];
  rangeB: [number, number];
  stepsA: number;
  stepsB: number;
  ipr: { q: number; pwf: number }[];
  qMax: number;
}

export interface Sens2DCell {
  a: number;
  b: number;
  qOp: number;
  pwfOp: number;
}

export function sweep2D(input: Sens2DInput): Sens2DCell[] {
  const { baseVLP, paramA, paramB, rangeA, rangeB, stepsA, stepsB, ipr, qMax } = input;
  const out: Sens2DCell[] = [];
  const qS = Math.max(50, qMax * 0.05);
  const nQ = 12;
  const qStep = (qMax - qS) / (nQ - 1);
  for (let i = 0; i < stepsA; i++) {
    const a = rangeA[0] + ((rangeA[1] - rangeA[0]) * i) / Math.max(1, stepsA - 1);
    for (let j = 0; j < stepsB; j++) {
      const b = rangeB[0] + ((rangeB[1] - rangeB[0]) * j) / Math.max(1, stepsB - 1);
      const merged: VLPInput = {
        ...(baseVLP as VLPInput),
        [paramA]: a,
        [paramB]: b,
        qLiqBpd: qS,
      } as VLPInput;
      const vlp: { q: number; pwf: number }[] = [];
      for (let k = 0; k < nQ; k++) {
        const q = qS + qStep * k;
        const r = calculatePwf31({ ...merged, qLiqBpd: q });
        vlp.push({ q, pwf: r.pwf });
      }
      const op = findOperatingPoint(ipr, vlp);
      out.push({ a, b, qOp: op?.q ?? 0, pwfOp: op?.pwf ?? 0 });
    }
  }
  return out;
}
