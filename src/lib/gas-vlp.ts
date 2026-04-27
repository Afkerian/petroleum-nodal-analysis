/**
 * Gas VLP — integración numérica segmentada del gradiente.
 *
 * Para cada segmento Δz:
 *   ρ_g = P·M / (Z·R·T)        (lb/ft³ con M = 28.96·γg, R = 10.73)
 *   v   = Q_actual / A          (ft/s)
 *   gradiente_hidrostático = ρ·cosθ / 144     (psi/ft)
 *   gradiente_friccional   = f·ρ·v² / (2·g_c·d) / 144
 *   P_{i+1} = P_i + gradiente·Δz
 *
 * Z se recalcula con la P promedio del tramo (DAK). T varía linealmente
 * entre cabeza y fondo. Más simple y estable que la formulación Cullender-Smith
 * cerrada porque no requiere iteración global.
 */
import { PVT } from "./pvt-correlations";

export interface GasVLPInput {
  lengthFt: number;
  tubingIdIn: number;
  pWh: number;
  tempWhF: number;
  tempBhF: number;
  qGasMMscfd: number;
  gasSg: number;
  inclinationDeg?: number;
}

export type GasVLPSteps = Record<string, number>;

export interface GasVLPResult {
  pwf: number;
  steps: GasVLPSteps;
  converged: boolean;
  iterations: number;
}

const frictionMoody = (re: number, eps: number): number => {
  if (re <= 0) return 0.02;
  if (re < 2300) return 64 / re;
  const denom = Math.log10(eps / 3.7 + 5.74 / Math.pow(re, 0.9));
  if (!Number.isFinite(denom) || denom === 0) return 0.02;
  const f = 0.25 / Math.pow(denom, 2);
  return Number.isFinite(f) ? f : 0.02;
};

export function calculateGasPwf(input: GasVLPInput): GasVLPResult {
  const {
    lengthFt: L,
    tubingIdIn: d,
    pWh,
    tempWhF,
    tempBhF,
    qGasMMscfd: qMM,
    gasSg,
    inclinationDeg = 0,
  } = input;

  const cosTheta = Math.cos((inclinationDeg * Math.PI) / 180);
  const pPc = 756.8 - 131 * gasSg;
  const tPc = 169.2 + 349.5 * gasSg;
  const N = 30;
  const dz = L / N;
  const dT = (tempBhF - tempWhF) / N;
  const dFt = d / 12;
  const A_ft2 = (Math.PI / 4) * dFt * dFt;
  const eps = 0.0006 / Math.max(d, 0.5);

  let p = pWh;
  let t = tempWhF;

  // Segmento por segmento — predictor-corrector simple (Heun) para estabilidad
  let zLast = 0.9;
  let rhoLast = 0;
  let muLast = 0.02;
  let vLast = 0;
  let reLast = 0;
  let fLast = 0;
  let bgLast = 0;

  for (let i = 0; i < N; i++) {
    const tR = t + 460;
    // Predictor: gradient at current P,T
    let pPred = p;
    for (let pass = 0; pass < 2; pass++) {
      const pAvg = 0.5 * (p + pPred);
      const ppr = pAvg / pPc;
      const tpr = tR / tPc;
      const z = PVT.zFactorDAK(ppr, tpr);
      const bg = (0.02825 * z * tR) / pAvg;
      const rho = bg > 0 ? (0.0764 * gasSg) / bg : 0;
      const qActFt3s = (qMM * 1e6 * bg) / 86400;
      const v = qActFt3s / Math.max(A_ft2, 1e-9);
      const mu = PVT.gasViscosityLee(t, rho, 28.96 * gasSg);
      const re = (1488 * rho * v * dFt) / Math.max(mu, 1e-4);
      const f = frictionMoody(re, eps);
      const gradHydro = (rho * cosTheta) / 144;
      const gradFric = (f * rho * v * v) / (2 * 32.2 * dFt) / 144;
      const grad = gradHydro + gradFric;
      pPred = p + grad * dz;
      // Save final-pass values
      zLast = z;
      rhoLast = rho;
      muLast = mu;
      vLast = v;
      reLast = re;
      fLast = f;
      bgLast = bg;
    }
    p = pPred;
    t += dT;
  }

  const steps: GasVLPSteps = {
    "Pwh (psi)": pWh,
    "Pwf (psi)": p,
    "ΔP (psi)": p - pWh,
    "Z (último segmento)": zLast,
    "Bg (último segmento, ft³/scf)": bgLast,
    "ρ_g (último segmento, lb/ft³)": rhoLast,
    "μ_g (último segmento, cp)": muLast,
    "v_g (último segmento, ft/s)": vLast,
    "Reynolds (último segmento)": reLast,
    "Factor fricción f": fLast,
    "Q (MMscfd)": qMM,
    "L (ft)": L,
    "Inclinación (°)": inclinationDeg,
    "Segmentos": N,
  };

  return { pwf: p, steps, converged: Number.isFinite(p) && p > pWh, iterations: N };
}
