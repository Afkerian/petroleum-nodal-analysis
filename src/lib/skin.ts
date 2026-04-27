/**
 * Análisis de skin compuesto. El skin total observado es suma de varios
 * componentes geométricos / mecánicos:
 *
 *   S_total = S_d + S_p + S_pp + S_dev + S_perf
 *
 * Donde:
 *   S_d  : Skin por daño de formación (Hawkins)
 *   S_p  : Pseudo-skin por perforación (Karakas-Tariq)
 *   S_pp : Skin por penetración parcial (Brons-Marting)
 *   S_dev: Skin por desviación del pozo (Cinco-Ley)
 *   S_perf: Skin por densidad de perforación
 *
 * Implementaciones simplificadas pedagógicas — los gráficos finales del IPR
 * deben usar S_total.
 */

export interface SkinHawkins {
  kFormation: number;  // md
  kDamaged: number;    // md (zona dañada)
  rDamaged: number;    // ft (radio de la zona dañada)
  rWell: number;       // ft
}

/** S_d Hawkins — skin por daño anular alrededor del pozo. */
export function skinHawkins({ kFormation, kDamaged, rDamaged, rWell }: SkinHawkins): number {
  if (kDamaged <= 0 || rWell <= 0 || rDamaged <= rWell) return 0;
  return (kFormation / kDamaged - 1) * Math.log(rDamaged / rWell);
}

export interface SkinPartial {
  hPenetrated: number; // ft (espesor abierto al flujo)
  hReservoir: number;  // ft (espesor total)
  rWell: number;       // ft
}

/**
 * Brons-Marting — skin por penetración parcial. Aproximación clásica:
 *   S_pp = ((1 − b)/b) · ln(h_d) − 2  con  b = h_p/h, h_d = h/(2·rw)·√(kh/kv)
 * Asumimos kh/kv = 1.
 */
export function skinPartialPenetration({ hPenetrated, hReservoir, rWell }: SkinPartial): number {
  if (hReservoir <= 0 || hPenetrated <= 0 || hPenetrated >= hReservoir) return 0;
  const b = hPenetrated / hReservoir;
  const hd = hReservoir / (2 * rWell);
  return Math.max(0, ((1 - b) / b) * Math.log(hd) - 2);
}

export interface SkinPerforation {
  shotsPerFt: number;
  perfLengthIn: number;  // longitud del túnel perforado, in
  perfDiameterIn: number; // diámetro del túnel, in
  rWell: number;          // ft
}

/**
 * Karakas-Tariq simplificado — skin geométrico por perforación.
 *   S_perf ≈ ln(rw / rwe)
 * con rwe (radio efectivo) función de SPF y geometría perforada.
 * Esta es una aproximación; KT exacto requiere ratios cuadráticos del túnel.
 */
export function skinPerforation({
  shotsPerFt,
  perfLengthIn,
  perfDiameterIn,
  rWell,
}: SkinPerforation): number {
  if (shotsPerFt <= 0 || perfLengthIn <= 0) return 5; // sin datos → conservador
  const Lp = perfLengthIn / 12; // ft
  const dp = perfDiameterIn / 12; // ft
  // Radio efectivo de pozo perforado (aproximación Cinco-Ley)
  const a = 0.25 * Math.PI * dp * shotsPerFt;
  const rwe = (Lp / 4) * Math.exp(-a);
  if (rwe <= 0) return 5;
  return Math.log(rWell / Math.max(rwe, 1e-4));
}

export interface SkinDeviation {
  inclinationDeg: number;
  hReservoir: number;
  rWell: number;
}

/**
 * Cinco-Ley simplificado — skin negativo por inclinación (mejora la
 * conectividad).
 *   S_dev ≈ −(θ/41)^2.06 − (θ/56)^1.865·log(h/rw/100)
 */
export function skinDeviation({ inclinationDeg, hReservoir, rWell }: SkinDeviation): number {
  const theta = Math.min(75, Math.max(0, inclinationDeg));
  const term1 = -Math.pow(theta / 41, 2.06);
  const ratio = hReservoir / Math.max(rWell, 1e-3) / 100;
  const term2 = -Math.pow(theta / 56, 1.865) * Math.log10(Math.max(ratio, 1e-3));
  const s = term1 + term2;
  return Number.isFinite(s) ? s : 0;
}

export interface SkinTotal {
  hawkins: number;
  partial: number;
  perforation: number;
  deviation: number;
  total: number;
}

export function skinTotal(parts: {
  hawkins?: number;
  partial?: number;
  perforation?: number;
  deviation?: number;
}): SkinTotal {
  const h = parts.hawkins ?? 0;
  const p = parts.partial ?? 0;
  const f = parts.perforation ?? 0;
  const d = parts.deviation ?? 0;
  return {
    hawkins: h,
    partial: p,
    perforation: f,
    deviation: d,
    total: h + p + f + d,
  };
}
