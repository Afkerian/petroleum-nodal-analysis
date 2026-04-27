/**
 * Modelos IPR (Inflow Performance Relationship).
 * Portado desde logic/ipr_models.py + extensiones (Joshi horizontal,
 * IPR compuesto Vogel-debajo / lineal-arriba de Pb).
 */
import { linspace } from "./pvt-correlations";

export type IPRPoint = { q: number; pwf: number };
export type IPRResult = { points: IPRPoint[] };

const buildPoints = (qArr: number[], pArr: number[]): IPRResult => ({
  points: qArr.map((q, i) => ({ q, pwf: pArr[i] })),
});

export const IPR = {
  vogel(qMax: number, pRes: number, steps = 30): IPRResult {
    const pwfArr = linspace(0, pRes, steps);
    const qArr = pwfArr.map((pwf) => {
      const r = pwf / pRes;
      return Math.max(0, qMax * (1 - 0.2 * r - 0.8 * r * r));
    });
    return buildPoints(qArr, pwfArr);
  },

  /** Darcy — flujo semi-estacionario vertical. */
  darcy(
    k: number,
    h: number,
    mu: number,
    bo: number,
    re: number,
    rw: number,
    s: number,
    pRes: number,
    steps = 30
  ): IPRResult {
    const pwfArr = linspace(0, pRes, steps);
    if (mu <= 0 || bo <= 0 || re <= rw) {
      return buildPoints(pwfArr.map(() => 0), pwfArr);
    }
    let denom = mu * bo * (Math.log(re / rw) - 0.75 + s);
    if (denom === 0) denom = 1e-6;
    const j = (0.00708 * k * h) / denom;
    const qArr = pwfArr.map((pwf) => Math.max(0, j * (pRes - pwf)));
    return buildPoints(qArr, pwfArr);
  },

  /**
   * Joshi (1988) — pozo horizontal de longitud L drenando una zona
   * elíptica de semi-eje mayor `a`. h es el espesor, βh = h/L con
   * corrección por anisotropía (k_v/k_h asumido = 1 aquí).
   *
   * J_h = (0.00708·k·h) /
   *       [μ·Bo·( ln{ [a + √(a² − (L/2)²)] / (L/2) }
   *              + (h/L)·ln[ h / (2·rw) ] )]
   *
   * `a` se obtiene de `re` (radio de drenaje equivalente) por:
   *   a = (L/2) · [0.5 + √(0.25 + (2·re/L)^4)]^0.5
   */
  joshi(
    k: number,
    h: number,
    mu: number,
    bo: number,
    re: number,
    rw: number,
    L: number,
    pRes: number,
    steps = 30
  ): IPRResult {
    const pwfArr = linspace(0, pRes, steps);
    if (mu <= 0 || bo <= 0 || L <= 0 || rw <= 0) {
      return buildPoints(pwfArr.map(() => 0), pwfArr);
    }
    const halfL = L / 2;
    const inner = 0.5 + Math.sqrt(0.25 + Math.pow((2 * re) / L, 4));
    const a = halfL * Math.sqrt(inner);
    const term1 = Math.log((a + Math.sqrt(Math.max(0, a * a - halfL * halfL))) / halfL);
    const term2 = (h / L) * Math.log(h / (2 * rw));
    let denom = mu * bo * (term1 + term2);
    if (denom <= 0) denom = 1e-6;
    const j = (0.00708 * k * h) / denom;
    const qArr = pwfArr.map((pwf) => Math.max(0, j * (pRes - pwf)));
    return buildPoints(qArr, pwfArr);
  },

  /** Fetkovich  Q = C·(Pr² − Pwf²)^n */
  fetkovich(c: number, n: number, pRes: number, steps = 30): IPRResult {
    const pwfArr = linspace(0, pRes, steps);
    const qArr = pwfArr.map((pwf) => {
      const term = Math.max(0, pRes * pRes - pwf * pwf);
      return c * Math.pow(term, n);
    });
    return buildPoints(qArr, pwfArr);
  },

  wiggins(qMax: number, pRes: number, steps = 30): IPRResult {
    const pwfArr = linspace(0, pRes, steps);
    const qArr = pwfArr.map((pwf) => {
      const r = pwf / pRes;
      return Math.max(0, qMax * (1 - 0.52 * r - 0.48 * r * r));
    });
    return buildPoints(qArr, pwfArr);
  },

  /**
   * IPR compuesto (yacimiento subsaturado: Pr > Pb).
   *   Pwf ≥ Pb : tramo lineal  q = J·(Pr − Pwf)
   *   Pwf < Pb : Vogel sobre el delta restante:
   *              q = J·(Pr − Pb) + (J·Pb/1.8)·[1 − 0.2·(Pwf/Pb) − 0.8·(Pwf/Pb)²]
   */
  composite(j: number, pRes: number, pb: number, steps = 60): IPRResult {
    const pwfArr = linspace(0, pRes, steps);
    const qBubble = j * Math.max(0, pRes - pb);
    const qmaxVogelTail = (j * pb) / 1.8;
    const qArr = pwfArr.map((pwf) => {
      if (pwf >= pb) return Math.max(0, j * (pRes - pwf));
      const r = pwf / pb;
      return qBubble + qmaxVogelTail * (1 - 0.2 * r - 0.8 * r * r);
    });
    return buildPoints(qArr, pwfArr);
  },

  /**
   * IPR de gas — back-pressure (Rawlins-Schellhardt).
   * AOF = C · Pr^(2n) cuando Pwf=0.
   */
  gas(c: number, n: number, pRes: number, steps = 30): IPRResult {
    const pwfArr = linspace(0, pRes, steps);
    const qArr = pwfArr.map((pwf) => {
      const term = Math.max(0, pRes * pRes - pwf * pwf);
      return c * Math.pow(term, n);
    });
    return buildPoints(qArr, pwfArr);
  },
};

export function gasAOF(c: number, n: number, pRes: number): number {
  return c * Math.pow(pRes * pRes, n);
}
