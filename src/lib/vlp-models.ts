/**
 * Algoritmo iterativo VLP — 31 pasos (Poettmann-Carpenter / metodología PDF).
 * Portado desde logic/vlp_models.py.
 *
 * El bucle ajusta ΔP por sustitución amortiguada hasta que ΔH ≈ Longitud.
 *
 * V2: clamp superior añadido en FTP (paso 28) para evitar gradientes
 * absurdos cuando Q es muy bajo y el "Factor A" se dispara.
 */
import { PVT } from "./pvt-correlations";
import { dunsRos } from "./duns-ros";

export interface VLPInput {
  lengthFt: number;
  tubingIdIn: number;
  pWh: number;
  tempWhF: number;
  tempBhF: number;
  qLiqBpd: number;
  gor: number;
  bsw: number;
  api: number;
  gasSg: number;
  waterSg: number;
  bw: number;
  /** "poettmann" (default), "hagedorn-brown" o "beggs-brill" */
  correlation?: VLPCorrelation;
  /** Inclinación respecto a la vertical, grados (0 = vertical). Solo Beggs-Brill. */
  inclinationDeg?: number;
}

export type VLPCorrelation =
  | "poettmann"
  | "hagedorn-brown"
  | "beggs-brill"
  | "duns-ros";

export type VLPSteps = Record<string, number>;

export interface VLPResult {
  pwf: number;
  steps: VLPSteps;
  converged: boolean;
  iterations: number;
}

export function calculatePwf31(input: VLPInput): VLPResult {
  const correlation = input.correlation ?? "poettmann";
  const inclination = input.inclinationDeg ?? 0;

  const {
    lengthFt,
    tubingIdIn,
    pWh,
    tempWhF,
    tempBhF,
    qLiqBpd,
    gor,
    bsw,
    api,
    gasSg,
    waterSg,
    bw,
  } = input;

  let deltaP = 100.0;
  const tolerance = 1.0;
  const maxIter = 200;

  let finalPwf = 0;
  let pasos: VLPSteps = {};
  let converged = false;
  let usedIters = 0;

  for (let iteration = 0; iteration < maxIter; iteration++) {
    usedIters = iteration + 1;

    const pAvg = pWh + deltaP / 2;
    const tAvg = (tempWhF + tempBhF) / 2;

    const pb = PVT.pbStanding(gor, gasSg, api, tAvg);
    const rs = pAvg < pb ? PVT.rsStanding(pAvg, gasSg, api, tAvg) : gor;

    const gammaO = 141.5 / (131.5 + api);
    const fFactor = rs * Math.pow(gasSg / gammaO, 0.5) + 1.25 * tAvg;
    const bo = 0.972 + 0.000147 * Math.pow(fFactor, 1.175);

    const gammaGd = 0.25 + 0.02 * api + 1e-6 * (0.6874 - 3.5864 * api) * rs;
    const rhoO = (62.4 * gammaO + 0.01362 * rs * gammaGd) / bo;

    const zVal = 3.0324 - 0.02023 * api;
    const yVal = Math.pow(10, zVal);
    const xVal = yVal * Math.pow(tAvg, -1.163);
    const muOm = Math.pow(10, xVal) - 1;
    const aVal = 10.715 * Math.pow(rs + 100, -0.515);
    const bVal = 5.44 * Math.pow(rs + 150, -0.338);
    const muO = aVal * Math.pow(muOm, bVal);

    const gammaGl =
      gor - rs > 0 ? (gor * gasSg - rs * gammaGd) / (gor - rs) : gasSg;

    const pPc = 756.8 - 131.0 * gasSg;
    const tPc = 169.2 + 349.5 * gasSg;
    const ppr = pAvg / pPc;
    const tpr = (tAvg + 460) / tPc;
    const z = PVT.zFactorDAK(ppr, tpr);

    const bg = (0.02825 * z * (tAvg + 460)) / pAvg;
    const rhoG = bg > 0 ? (0.0764 * gammaGl) / bg : 0;
    const muG = PVT.gasViscosityLee(tAvg, rhoG, 28.96 * gammaGl);

    const qw = qLiqBpd * (bsw / 100);
    const qo = qLiqBpd - qw;
    const wor = qo > 0 ? qw / qo : 0;

    const qLiqRes = qo * bo + qw * bw;
    const qGasRes = (qo * Math.max(0, gor - rs) * bg) / 5.615;
    const lam = qLiqRes + qGasRes > 0 ? qLiqRes / (qLiqRes + qGasRes) : 1;

    const vsl = (0.01191 * (qo * bo + qw * bw)) / (tubingIdIn * tubingIdIn);
    const vsg =
      (0.002122 * qo * Math.max(0, gor - rs) * bg) / (tubingIdIn * tubingIdIn);

    const fo = bo / (bo + wor * bw);
    const rhoW = 62.4 * waterSg;
    const rhoL = rhoO * fo + rhoW * (1 - fo);
    const rhoM = rhoL * lam + rhoG * (1 - lam);

    const numP23 = 350.5 * (gammaO + waterSg * wor) + 0.0764 * gor * gasSg;
    const denP23 = 5.615 * (bo + bw * wor) + (gor - rs) * bg;
    const rhoMes2 = denP23 > 0 ? numP23 / denP23 : rhoM;

    const muW = 0.5;
    const muL = muO * fo + muW * (1 - fo);
    const muM = muL * lam + muG * (1 - lam);

    const massM = 350.5 * gammaO + 0.0764 * gor * gasSg + 350.5 * waterSg * wor;
    const factorA = qo * massM > 0 ? (tubingIdIn * 1e6) / (qo * massM) : 999999;

    let ftp =
      0.005415 -
      0.0005723 * factorA +
      0.0001848 * factorA * factorA +
      3.5843e-6 * Math.pow(factorA, 3);
    if (ftp < 0.001) ftp = 0.005;
    if (ftp > 0.5) ftp = 0.5; // clamp superior — evita gradientes absurdos en Q→0

    let gradient = computeGradient(
      correlation,
      rhoMes2,
      rhoL,
      rhoG,
      lam,
      vsl,
      vsg,
      ftp,
      qo,
      massM,
      tubingIdIn,
      muM,
      inclination
    );
    if (gradient <= 0) gradient = 0.001;

    const deltaH = deltaP / gradient;
    const pwfCandidate = pWh + deltaP;

    pasos = {
      "Paso 1 (P_avg, psi)": pAvg,
      "Paso 2 (Pb, psi)": pb,
      "Paso 3 (Rs, scf/STB)": rs,
      "Paso 4 (F)": fFactor,
      "Paso 5 (Bo, rb/STB)": bo,
      "Paso 6 (γ_gd)": gammaGd,
      "Paso 7 (ρ_o, lb/ft³)": rhoO,
      "Paso 8 (μ_o, cp)": muO,
      "Paso 9 (γ_gl)": gammaGl,
      "Paso 10 (Z)": z,
      "Paso 11 (Bg, ft³/scf)": bg,
      "Paso 12 (ρ_g, lb/ft³)": rhoG,
      "Paso 13 (μ_g, cp)": muG,
      "Paso 14 (Qw, BPD)": qw,
      "Paso 15 (λ)": lam,
      "Paso 16 (VSL, ft/s)": vsl,
      "Paso 17 (VSG, ft/s)": vsg,
      "Paso 18 (WOR)": wor,
      "Paso 19 (fo)": fo,
      "Paso 20 (ρ_w, lb/ft³)": rhoW,
      "Paso 21 (ρ_l, lb/ft³)": rhoL,
      "Paso 22 (ρ_m, lb/ft³)": rhoM,
      "Paso 23 (ρ_eq, lb/ft³)": rhoMes2,
      "Paso 24 (μ_l, cp)": muL,
      "Paso 25 (μ_m, cp)": muM,
      "Paso 26 (Masa M, lb/STB)": massM,
      "Paso 27 (Factor A)": factorA,
      "Paso 28 (FTP)": ftp,
      "Paso 29 (Gradiente, psi/ft)": gradient,
      "Paso 30 (ΔH, ft)": deltaH,
      "Paso 31 (Pwf, psi)": pwfCandidate,
    };

    if (Math.abs(deltaH - lengthFt) <= tolerance) {
      finalPwf = pwfCandidate;
      converged = true;
      break;
    }

    const newDeltaP = gradient * lengthFt;
    deltaP = 0.5 * deltaP + 0.5 * newDeltaP;
  }

  if (!converged) finalPwf = pWh + deltaP;

  return { pwf: finalPwf, steps: pasos, converged, iterations: usedIters };
}

/**
 * Gradiente de presión según la correlación seleccionada.
 *
 * - Poettmann-Carpenter: la del PDF (1/144)·(ρ_eq + fricción·...).
 * - Hagedorn-Brown: usa el holdup HL de la correlación de Griffith
 *   simplificada (HL = 1 − 0.5·(1 + vm/vs) − 0.5·√((1+vm/vs)² − 4·vsg/vs))
 *   con vs = 0.8 ft/s. Fricción Moody con Re Reynolds bifásico.
 * - Beggs-Brill: holdup según patrón (segregado / intermitente / distribuido)
 *   con corrección por inclinación. Implementación reducida pero fiel a la
 *   estructura original (1973).
 */
function computeGradient(
  correlation: VLPCorrelation,
  rhoMes2: number,
  rhoL: number,
  rhoG: number,
  lam: number,
  vsl: number,
  vsg: number,
  ftp: number,
  qo: number,
  massM: number,
  tubingIdIn: number,
  muM: number,
  inclinationDeg: number
): number {
  if (correlation === "poettmann") {
    return (
      (1 / 144) *
      (rhoMes2 +
        (ftp * Math.pow(qo * massM, 2)) /
          (2.979e5 * rhoMes2 * Math.pow(tubingIdIn, 5)))
    );
  }

  // Mezcla y velocidades comunes a HB y BB
  const vm = vsl + vsg;
  const dFt = tubingIdIn / 12;
  const cosTheta = Math.cos((inclinationDeg * Math.PI) / 180);

  if (correlation === "hagedorn-brown") {
    // Slip velocity (Griffith simplificada)
    const vs = 0.8;
    const inside = Math.pow(1 + vm / vs, 2) - (4 * vsg) / vs;
    const sqrtInside = inside > 0 ? Math.sqrt(inside) : 0;
    let hl = 1 - 0.5 * (1 + vm / vs) + 0.5 * sqrtInside;
    if (!Number.isFinite(hl) || hl < lam) hl = lam;
    if (hl > 1) hl = 1;
    const rhoTp = rhoL * hl + rhoG * (1 - hl);
    // Friction Moody (rugosidad asumida 0.0006 in/ID)
    const re = (1488 * rhoTp * vm * dFt) / Math.max(muM, 1e-3);
    const f = frictionMoody(re, 0.0006 / Math.max(tubingIdIn, 0.5));
    return (1 / 144) * (rhoTp * cosTheta + (f * rhoTp * vm * vm) / (2 * 32.2 * dFt));
  }

  if (correlation === "duns-ros") {
    const dr = dunsRos({
      vsl,
      vsg,
      rhoL,
      rhoG,
      muL: muM,
      muG: muM * 0.05 + 1e-3,
      sigma: 30,
      tubingIdIn,
      inclinationDeg,
    });
    return dr.gradient;
  }

  if (correlation === "beggs-brill") {
    // Patrones según número de Froude
    const fr = (vm * vm) / (32.2 * dFt);
    const lambdaL = lam;
    const L1 = 316 * Math.pow(lambdaL, 0.302);
    const L2 = 9.252e-4 * Math.pow(lambdaL, -2.4684);
    const L3 = 0.10 * Math.pow(lambdaL, -1.4516);
    const L4 = 0.5 * Math.pow(lambdaL, -6.738);

    let hl0: number;
    if ((lambdaL < 0.01 && fr < L1) || (lambdaL >= 0.01 && fr < L2)) {
      // Segregado
      hl0 = (0.98 * Math.pow(lambdaL, 0.4846)) / Math.pow(fr, 0.0868);
    } else if (lambdaL >= 0.01 && fr >= L2 && fr <= L3) {
      // Transición — interpolación lineal entre segregado e intermitente (simplificada)
      hl0 = (0.845 * Math.pow(lambdaL, 0.5351)) / Math.pow(fr, 0.0173);
    } else if ((lambdaL >= 0.01 && lambdaL < 0.4 && fr > L3 && fr <= L4) || (lambdaL >= 0.4 && fr > L3 && fr <= L4)) {
      hl0 = (0.845 * Math.pow(lambdaL, 0.5351)) / Math.pow(fr, 0.0173);
    } else {
      hl0 = (1.065 * Math.pow(lambdaL, 0.5824)) / Math.pow(fr, 0.0609);
    }
    if (!Number.isFinite(hl0) || hl0 < lambdaL) hl0 = lambdaL;
    if (hl0 > 1) hl0 = 1;
    const sin2t = Math.sin((2 * inclinationDeg * Math.PI) / 180);
    const psi = 1 + 0.3 * sin2t;
    const hl = Math.min(1, Math.max(lambdaL, hl0 * psi));
    const rhoTp = rhoL * hl + rhoG * (1 - hl);
    const re = (1488 * rhoTp * vm * dFt) / Math.max(muM, 1e-3);
    const f = frictionMoody(re, 0.0006 / Math.max(tubingIdIn, 0.5));
    return (1 / 144) * (rhoTp * cosTheta + (f * rhoTp * vm * vm) / (2 * 32.2 * dFt));
  }

  return (
    (1 / 144) *
    (rhoMes2 +
      (ftp * Math.pow(qo * massM, 2)) /
        (2.979e5 * rhoMes2 * Math.pow(tubingIdIn, 5)))
  );
}

/** Factor de fricción Darcy de Moody (Colebrook explícito por Swamee-Jain). */
function frictionMoody(re: number, eps: number): number {
  if (re <= 0) return 0.02;
  if (re < 2300) return 64 / re;
  const denom = Math.log10(eps / 3.7 + 5.74 / Math.pow(re, 0.9));
  if (!Number.isFinite(denom) || denom === 0) return 0.02;
  const f = 0.25 / Math.pow(denom, 2);
  return Number.isFinite(f) ? f : 0.02;
}
