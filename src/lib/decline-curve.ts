/**
 * Análisis de declinación de Arps (1945).
 *
 * Tres modelos:
 *   - Exponencial   (b = 0)   q(t) = qi · exp(−Di·t)
 *   - Hiperbólica   (0<b<1)   q(t) = qi / (1 + b·Di·t)^(1/b)
 *   - Armónica      (b = 1)   q(t) = qi / (1 + Di·t)
 *
 * Producción acumulada Np(t):
 *   Exp:        Np = (qi − q) / Di
 *   Harm:       Np = (qi/Di) · ln(qi/q)
 *   Hyperbólico: Np = (qi^b / ((1−b)·Di)) · (qi^(1−b) − q^(1−b))
 *
 * Tiempo en años, q en STB/d (o MMscfd para gas).
 */

export type DeclineKind = "exponential" | "hyperbolic" | "harmonic";

export interface DeclineInput {
  qi: number;          // STB/d (or MMscfd)
  diYearly: number;    // 1/year
  b?: number;          // exponente Arps (solo hyperbolic)
  qAbandon: number;    // STB/d — cutoff
  years: number;       // horizonte máximo
  kind: DeclineKind;
}

export interface DeclinePoint {
  year: number;
  q: number;          // BPD (or MMscfd)
  qDaily: number;     // q (igual unidad de input)
  cumStb: number;     // bbl o MMscf acumulados
}

const DAYS_PER_YEAR = 365.25;

export function arpsDecline(input: DeclineInput): {
  series: DeclinePoint[];
  eur: number;        // STB o MMscf totales hasta abandono
  yearsToAbandon: number;
} {
  const { qi, diYearly, b = 0.5, qAbandon, years, kind } = input;
  const dt = 1 / 12; // mensual
  const series: DeclinePoint[] = [];
  let cum = 0;
  let yearsToAbandon = years;
  let prevQ = qi;
  for (let t = 0; t <= years; t += dt) {
    let q: number;
    if (kind === "exponential") {
      q = qi * Math.exp(-diYearly * t);
    } else if (kind === "harmonic") {
      q = qi / (1 + diYearly * t);
    } else {
      q = qi / Math.pow(1 + b * diYearly * t, 1 / Math.max(b, 1e-3));
    }
    if (t > 0) {
      // Trapezoidal: ΔNp = 0.5·(q + prevQ)·dt en STB/year × dt[year]
      cum += 0.5 * (q + prevQ) * dt * DAYS_PER_YEAR;
    }
    series.push({ year: t, q, qDaily: q, cumStb: cum });
    if (q <= qAbandon) {
      yearsToAbandon = t;
      break;
    }
    prevQ = q;
  }
  return {
    series,
    eur: cum,
    yearsToAbandon,
  };
}
