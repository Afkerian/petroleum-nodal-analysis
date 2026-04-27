/**
 * Correlaciones PVT.
 *
 * Originales (V1):
 *   - Pb / Rs / Bo: Standing
 *   - μ_o: Beggs-Robinson + Chew-Connally
 *   - Z: Dranchuk-Abou-Kassem (DAK) — corregido respecto al Python original
 *     (la versión Python abandonaba el Newton-Raphson en la primera vuelta).
 *   - μ_g: Lee-Gonzalez-Eakin
 *
 * Adiciones (V2):
 *   - Pb: Lasater, Glaso, Vazquez-Beggs
 *   - Bo: Vazquez-Beggs
 *   - μ_o subsaturado: corrección Vazquez-Beggs por presión
 *   - Z: Hall-Yarborough como alternativa a DAK
 *
 * Todas trabajan en field units (psi, °F, scf/STB, rb/STB).
 */

const linspace = (start: number, end: number, n: number): number[] => {
  if (n <= 1) return [start];
  const step = (end - start) / (n - 1);
  return Array.from({ length: n }, (_, i) => start + step * i);
};

const apiToGammaO = (api: number): number => 141.5 / (131.5 + api);

export const PVT = {
  // ─────────────────────────── Pb (presión de burbuja) ───────────────────────────

  /** Pb por Standing (psi). */
  pbStanding(rs: number, gammaG: number, api: number, tempF: number): number {
    if (gammaG <= 0) return 0;
    const exponent = 0.00091 * tempF - 0.0125 * api;
    return 18 * Math.pow(rs / gammaG, 0.83) * Math.pow(10, exponent);
  },

  /**
   * Pb por Lasater. Usa la fracción molar de gas yg.
   * Mo = peso molecular del petróleo (correlación Cragoe).
   */
  pbLasater(rs: number, gammaG: number, api: number, tempF: number): number {
    if (gammaG <= 0 || rs <= 0) return 0;
    const gammaO = apiToGammaO(api);
    const mo = api <= 40 ? 630 - 10 * api : 73110 * Math.pow(api, -1.562);
    const yg = (rs / 379.3) / (rs / 379.3 + (350 * gammaO) / mo);
    let pf: number;
    if (yg <= 0.6) {
      pf = 0.679 * Math.exp(2.786 * yg) - 0.323;
    } else {
      pf = 8.26 * Math.pow(yg, 3.56) + 1.95;
    }
    return (pf * (tempF + 460)) / gammaG;
  },

  /** Pb por Glaso. */
  pbGlaso(rs: number, gammaG: number, api: number, tempF: number): number {
    if (gammaG <= 0 || rs <= 0) return 0;
    const a = Math.pow(rs / gammaG, 0.816) * Math.pow(tempF, 0.172) * Math.pow(api, -0.989);
    const log10 = 1.7669 + 1.7447 * Math.log10(a) - 0.30218 * Math.pow(Math.log10(a), 2);
    return Math.pow(10, log10);
  },

  /**
   * Pb por Vazquez-Beggs (separator-corrected). Despejada de:
   *   Rs = c1·γg·P^c2·exp(c3·API/T_R)
   * Importante: la correlación V-B es base **e**, no base 10. (Bug previo
   * de la versión 1.x corregido aquí.)
   */
  pbVazquezBeggs(
    rs: number,
    gammaG: number,
    api: number,
    tempF: number
  ): number {
    if (gammaG <= 0 || rs <= 0) return 0;
    const c1 = api <= 30 ? 0.0362 : 0.0178;
    const c2 = api <= 30 ? 1.0937 : 1.187;
    const c3 = api <= 30 ? 25.724 : 23.931;
    const tR = tempF + 460;
    const inside = rs / (c1 * gammaG * Math.exp((c3 * api) / tR));
    if (inside <= 0) return 0;
    return Math.pow(inside, 1 / c2);
  },

  // ─────────────────────────── Rs (gas disuelto) ───────────────────────────

  /** Rs por Standing (scf/STB). */
  rsStanding(p: number, gammaG: number, api: number, tempF: number): number {
    const exponent = 0.0125 * api - 0.00091 * tempF;
    const inside = (p / 18) * Math.pow(10, exponent);
    if (inside <= 0) return 0;
    return gammaG * Math.pow(inside, 1.2048);
  },

  /** Rs por Vazquez-Beggs. */
  rsVazquezBeggs(
    p: number,
    gammaG: number,
    api: number,
    tempF: number
  ): number {
    const c1 = api <= 30 ? 0.0362 : 0.0178;
    const c2 = api <= 30 ? 1.0937 : 1.187;
    const c3 = api <= 30 ? 25.724 : 23.931;
    const tR = tempF + 460;
    return c1 * gammaG * Math.pow(p, c2) * Math.exp((c3 * api) / tR);
  },

  // ─────────────────────────── Bo (factor volumétrico) ───────────────────────────

  /** Bo por Standing (rb/STB). */
  boStanding(rs: number, gammaG: number, gammaO: number, tempF: number): number {
    if (gammaO <= 0) return 1;
    const f = rs * Math.pow(gammaG / gammaO, 0.5) + 1.25 * tempF;
    return 0.9759 + 1.2e-4 * Math.pow(f, 1.2);
  },

  /** Bo por Vazquez-Beggs. */
  boVazquezBeggs(
    rs: number,
    gammaG: number,
    api: number,
    tempF: number
  ): number {
    const c1 = api <= 30 ? 4.677e-4 : 4.67e-4;
    const c2 = api <= 30 ? 1.751e-5 : 1.1e-5;
    const c3 = api <= 30 ? -1.811e-8 : 1.337e-9;
    return 1 + c1 * rs + c2 * (tempF - 60) * (api / gammaG) + c3 * rs * (tempF - 60) * (api / gammaG);
  },

  // ─────────────────────────── Densidades ───────────────────────────

  oilDensity(api: number, rs: number, bo: number, gammaG: number): number {
    const gammaO = apiToGammaO(api);
    if (bo <= 0) return 62.4 * gammaO;
    return (62.4 * gammaO + 0.0136 * rs * gammaG) / bo;
  },

  // ─────────────────────────── Viscosidad de petróleo ───────────────────────────

  muOilBeggsRobinson(
    api: number,
    tempF: number,
    rs = 0,
    p = 0,
    pb = 0
  ): number {
    const x = Math.pow(10, 3.0324 - 0.02023 * api) * Math.pow(tempF, -1.163);
    const muOd = Math.pow(10, x) - 1;
    if (rs === 0) return muOd;

    const a = 10.715 * Math.pow(rs + 100, -0.515);
    const b = 5.44 * Math.pow(rs + 150, -0.338);
    const muOb = a * Math.pow(muOd, b);

    if (p > pb && pb > 0) {
      return PVT.muOilVazquezBeggs(muOb, p, pb);
    }
    return muOb;
  },

  /**
   * Corrección Vazquez-Beggs para μ_o subsaturado (P > Pb):
   *   μ_o = μ_ob · (P / Pb) ^ m
   *   m = 2.6 · P^1.187 · exp(-11.513 - 8.98e-5·P)
   */
  muOilVazquezBeggs(muOb: number, p: number, pb: number): number {
    if (pb <= 0 || p <= pb) return muOb;
    const m = 2.6 * Math.pow(p, 1.187) * Math.exp(-11.513 - 8.98e-5 * p);
    return muOb * Math.pow(p / pb, m);
  },

  // ─────────────────────────── Z-factor ───────────────────────────

  /**
   * Z por Dranchuk-Abou-Kassem (DAK) — Newton-Raphson sobre ρr.
   * Residual: f(ρr) = ρr + c1·ρr² + c2·ρr³ + c3·ρr⁶
   *           + (A10/Tpr³)·(1 + A11·ρr²)·ρr³·exp(-A11·ρr²) − 0.27·Ppr/Tpr
   */
  zFactorDAK(ppr: number, tpr: number): number {
    const A1 = 0.3265,
      A2 = -1.07,
      A3 = -0.5339,
      A4 = 0.01569,
      A5 = -0.05165,
      A6 = 0.5475,
      A7 = -0.7361,
      A8 = 0.1844,
      A9 = 0.1056,
      A10 = 0.6134,
      A11 = 0.721;

    const c1 = A1 + A2 / tpr + A3 / Math.pow(tpr, 3) + A4 / Math.pow(tpr, 4) + A5 / Math.pow(tpr, 5);
    const c2 = A6 + A7 / tpr + A8 / Math.pow(tpr, 2);
    const c3 = -A9 * (A7 / tpr + A8 / Math.pow(tpr, 2));
    const c4 = A10 / Math.pow(tpr, 3);
    const target = (0.27 * ppr) / tpr;

    let zSeed =
      1 -
      (3.52 * ppr) / Math.pow(10, 0.9813 * tpr) +
      (0.274 * ppr * ppr) / Math.pow(10, 0.8157 * tpr);
    if (!Number.isFinite(zSeed) || zSeed < 0.2) zSeed = 0.9;
    let rho = (0.27 * ppr) / (zSeed * tpr);
    if (!Number.isFinite(rho) || rho <= 0) rho = 0.27;

    for (let i = 0; i < 80; i++) {
      const r2 = rho * rho;
      const r3 = r2 * rho;
      const r5 = r2 * r3;
      const r6 = r3 * r3;
      const expTerm = Math.exp(-A11 * r2);

      const f =
        rho +
        c1 * r2 +
        c2 * r3 +
        c3 * r6 +
        c4 * (1 + A11 * r2) * r3 * expTerm -
        target;

      const dGexp = expTerm * (3 * r2 + 3 * A11 * (r2 * r2) - 2 * A11 * A11 * r6);
      const df = 1 + 2 * c1 * rho + 3 * c2 * r2 + 6 * c3 * r5 + c4 * dGexp;

      if (!Number.isFinite(df) || Math.abs(df) < 1e-12) break;
      let next = rho - f / df;
      if (!Number.isFinite(next)) break;
      if (next <= 0) next = rho * 0.5;
      if (next > 3) next = Math.min(3, rho * 1.5);
      if (Math.abs(next - rho) < 1e-9) {
        rho = next;
        break;
      }
      rho = next;
    }

    const z = (0.27 * ppr) / (rho * tpr);
    if (!Number.isFinite(z) || z <= 0) return 0.9;
    return z;
  },

  /**
   * Z por Hall-Yarborough — Newton-Raphson sobre la densidad reducida y.
   * Válido para Tpr > 1.0. Más rápido que DAK.
   *   f(y) = -A·Ppr + (y + y² + y³ - y⁴) / (1 - y)³
   *          - B·y² + C·y^D = 0
   *   A = 0.06125·t·exp(-1.2·(1-t)²),  t = 1/Tpr
   *   B = 14.76·t - 9.76·t² + 4.58·t³
   *   C = 90.7·t - 242.2·t² + 42.4·t³
   *   D = 2.18 + 2.82·t
   */
  zFactorHallYarborough(ppr: number, tpr: number): number {
    if (tpr <= 1.0) return PVT.zFactorDAK(ppr, tpr);
    const t = 1 / tpr;
    const a = 0.06125 * t * Math.exp(-1.2 * Math.pow(1 - t, 2));
    const b = 14.76 * t - 9.76 * t * t + 4.58 * t * t * t;
    const c = 90.7 * t - 242.2 * t * t + 42.4 * t * t * t;
    const d = 2.18 + 2.82 * t;

    let y = 0.001 * ppr;
    if (!Number.isFinite(y) || y <= 0) y = 0.01;

    for (let i = 0; i < 60; i++) {
      const y2 = y * y;
      const y3 = y2 * y;
      const y4 = y3 * y;
      const oneMinusY = 1 - y;
      const oneMinusY3 = oneMinusY * oneMinusY * oneMinusY;
      if (oneMinusY <= 0) {
        y = y * 0.5;
        continue;
      }

      const f =
        -a * ppr +
        (y + y2 + y3 - y4) / oneMinusY3 -
        b * y2 +
        c * Math.pow(y, d);

      const dfdy =
        (1 + 4 * y + 4 * y2 - 4 * y3 + y4) / Math.pow(oneMinusY, 4) -
        2 * b * y +
        c * d * Math.pow(y, d - 1);

      if (!Number.isFinite(dfdy) || Math.abs(dfdy) < 1e-12) break;
      let next = y - f / dfdy;
      if (!Number.isFinite(next) || next <= 0) next = y * 0.5;
      if (next >= 1) next = 0.5 * (y + 1);
      if (Math.abs(next - y) < 1e-9) {
        y = next;
        break;
      }
      y = next;
    }

    const z = (a * ppr) / y;
    if (!Number.isFinite(z) || z <= 0) return PVT.zFactorDAK(ppr, tpr);
    return z;
  },

  // ─────────────────────────── Viscosidad de gas ───────────────────────────

  gasViscosityLee(tempF: number, rhoG: number, mg: number): number {
    const tempR = tempF + 460;
    const k = ((9.4 + 0.02 * mg) * Math.pow(tempR, 1.5)) / (209 + 19 * mg + tempR);
    const x = 3.5 + 986 / tempR + 0.01 * mg;
    const y = 2.4 - 0.2 * x;
    const muG = 1e-4 * k * Math.exp(x * Math.pow(rhoG / 62.4, y));
    return Number.isFinite(muG) ? muG : 0.02;
  },

  waterRate(bsw: number, qo: number): number {
    if (bsw >= 100) return 0;
    return qo * (bsw / (100 - bsw));
  },
};

export type PbCorrelation = "standing" | "lasater" | "glaso" | "vazquez-beggs";
export type BoCorrelation = "standing" | "vazquez-beggs";
export type ZCorrelation = "dak" | "hall-yarborough";

export function pickPb(
  c: PbCorrelation,
  rs: number,
  gammaG: number,
  api: number,
  tempF: number
): number {
  switch (c) {
    case "lasater":
      return PVT.pbLasater(rs, gammaG, api, tempF);
    case "glaso":
      return PVT.pbGlaso(rs, gammaG, api, tempF);
    case "vazquez-beggs":
      return PVT.pbVazquezBeggs(rs, gammaG, api, tempF);
    default:
      return PVT.pbStanding(rs, gammaG, api, tempF);
  }
}

export function pickRs(
  c: BoCorrelation,
  p: number,
  gammaG: number,
  api: number,
  tempF: number
): number {
  if (c === "vazquez-beggs") return PVT.rsVazquezBeggs(p, gammaG, api, tempF);
  return PVT.rsStanding(p, gammaG, api, tempF);
}

export function pickBo(
  c: BoCorrelation,
  rs: number,
  gammaG: number,
  api: number,
  tempF: number
): number {
  if (c === "vazquez-beggs") return PVT.boVazquezBeggs(rs, gammaG, api, tempF);
  return PVT.boStanding(rs, gammaG, apiToGammaO(api), tempF);
}

export function pickZ(c: ZCorrelation, ppr: number, tpr: number): number {
  return c === "hall-yarborough"
    ? PVT.zFactorHallYarborough(ppr, tpr)
    : PVT.zFactorDAK(ppr, tpr);
}

export { linspace };
