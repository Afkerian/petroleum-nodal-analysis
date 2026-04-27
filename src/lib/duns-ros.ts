/**
 * Duns-Ros (1963) — clasificación de patrón de flujo + holdup y gradiente
 * para cada región. Implementación reducida pensada para uso pedagógico:
 *
 * Regiones:
 *   I   — Burbuja / Plug   (Nvg < L1 + L2·Nvs)
 *   II  — Slug             (L1 + L2·Nvs ≤ Nvg ≤ 50 + 36·Nvs)
 *   III — Mist (anular)    (Nvg > 75 + 84·Nvs^0.75)
 *   T   — Transición entre II y III (interpolación lineal)
 *
 * Números adimensionales (en field units):
 *   Nvs = 1.938·vsl·(ρL/σ)^(1/4)
 *   Nvg = 1.938·vsg·(ρL/σ)^(1/4)
 *   ND  = 120.872·d·(ρL/σ)^(1/2)
 *   NL  = 0.15726·μL·(1/(ρL·σ³))^(1/4)
 *
 * Constantes L1, L2 dependen de ND (tabuladas, simplificación cuadrática).
 */

export type DunsRosRegion = "I" | "II" | "III" | "T";

export interface DunsRosResult {
  region: DunsRosRegion;
  hl: number; // holdup de líquido
  gradient: number; // psi/ft
  numbers: { Nvs: number; Nvg: number; ND: number; NL: number };
}

interface DunsRosInput {
  vsl: number; // ft/s
  vsg: number; // ft/s
  rhoL: number; // lb/ft³
  rhoG: number; // lb/ft³
  muL: number; // cp
  muG: number; // cp
  sigma: number; // dynas/cm — tensión interfacial líquido-gas (default ~30)
  tubingIdIn: number;
  inclinationDeg?: number;
}

const frictionMoody = (re: number, eps: number): number => {
  if (re <= 0) return 0.02;
  if (re < 2300) return 64 / re;
  const denom = Math.log10(eps / 3.7 + 5.74 / Math.pow(re, 0.9));
  if (!Number.isFinite(denom) || denom === 0) return 0.02;
  return 0.25 / Math.pow(denom, 2);
};

export function dunsRos(input: DunsRosInput): DunsRosResult {
  const {
    vsl,
    vsg,
    rhoL,
    rhoG,
    muL,
    muG,
    sigma,
    tubingIdIn,
    inclinationDeg = 0,
  } = input;

  const sig = Math.max(sigma, 5);
  const Nvs = 1.938 * Math.max(0, vsl) * Math.pow(rhoL / sig, 0.25);
  const Nvg = 1.938 * Math.max(0, vsg) * Math.pow(rhoL / sig, 0.25);
  const ND = 120.872 * (tubingIdIn / 12) * Math.pow(rhoL / sig, 0.5);
  const NL =
    0.15726 *
    Math.max(muL, 1e-3) *
    Math.pow(1 / Math.max(rhoL * sig * sig * sig, 1e-9), 0.25);

  // L1, L2 simplificados en función de ND (curva cuadrática del Duns-Ros original)
  const L1 = 2 + 0.001 * ND - 1e-6 * ND * ND;
  const L2 = 1.6 + 0.0006 * ND;

  let region: DunsRosRegion;
  const limI_II = L1 + L2 * Nvs;
  const limII_III = 50 + 36 * Nvs;
  const limIII = 75 + 84 * Math.pow(Math.max(0, Nvs), 0.75);

  if (Nvg < limI_II) region = "I";
  else if (Nvg <= limII_III) region = "II";
  else if (Nvg > limIII) region = "III";
  else region = "T";

  // Holdup approximations per region
  const lambda = vsl + vsg > 0 ? vsl / (vsl + vsg) : 1;
  let hl: number;
  if (region === "I") {
    // Bubble: alto holdup (~ lambda + slip pequeño)
    hl = Math.min(1, lambda + 0.1 * (1 - lambda));
  } else if (region === "II") {
    // Slug: hold-up intermedio
    hl = Math.min(1, Math.max(lambda, 0.45 * Math.pow(Nvs / Math.max(Nvg, 0.01), 0.3)));
  } else if (region === "III") {
    // Mist: bajo holdup, casi no slip — HL ≈ lambda
    hl = lambda;
  } else {
    // Transición — interpolar entre slug y mist
    const t = (Nvg - limII_III) / Math.max(limIII - limII_III, 1e-3);
    const hlSlug = Math.min(1, Math.max(lambda, 0.45 * Math.pow(Nvs / Math.max(Nvg, 0.01), 0.3)));
    const hlMist = lambda;
    hl = (1 - t) * hlSlug + t * hlMist;
  }
  if (!Number.isFinite(hl) || hl < 0) hl = lambda;

  const rhoTp = rhoL * hl + rhoG * (1 - hl);
  const dFt = tubingIdIn / 12;
  const vm = vsl + vsg;
  const muM = muL * hl + muG * (1 - hl);
  const re = (1488 * rhoTp * vm * dFt) / Math.max(muM, 1e-3);
  const f = frictionMoody(re, 0.0006 / Math.max(tubingIdIn, 0.5));
  const cosTheta = Math.cos((inclinationDeg * Math.PI) / 180);

  const gradient =
    (1 / 144) * (rhoTp * cosTheta + (f * rhoTp * vm * vm) / (2 * 32.2 * dFt));

  return {
    region,
    hl,
    gradient,
    numbers: { Nvs, Nvg, ND, NL },
  };
}

/** Integra el gradiente sobre `lengthFt` en pasos lineales para obtener Pwf. */
export function calculatePwfDunsRos(
  baseInputs: DunsRosInput,
  lengthFt: number,
  pWh: number
): { pwf: number; region: DunsRosRegion; gradient: number; hl: number } {
  const r = dunsRos(baseInputs);
  return { pwf: pWh + r.gradient * lengthFt, region: r.region, gradient: r.gradient, hl: r.hl };
}
