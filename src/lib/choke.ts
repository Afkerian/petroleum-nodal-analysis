/**
 * Comportamiento de chokes (orificios de superficie) en flujo crítico.
 *
 * Correlación de Gilbert (1954) — la más usada en pozos de petróleo:
 *   P_wh = (435 · R^0.546 · Q) / D^1.89
 *
 * Donde:
 *   P_wh  = presión cabeza upstream del choke (psi)
 *   R     = relación gas-líquido producida (scf/STB)
 *   Q     = caudal líquido (STB/d)
 *   D     = diámetro del choke en 1/64 in
 *
 * Variantes (Ros, Baxendell, Achong) tienen los mismos exponentes con
 * coeficientes distintos. Aquí ofrezco las 4.
 */

export type ChokeCorrelation = "gilbert" | "ros" | "baxendell" | "achong";

const COEFFS: Record<
  ChokeCorrelation,
  { a: number; b: number; c: number }
> = {
  gilbert: { a: 10.0, b: 0.546, c: 1.89 },
  ros: { a: 17.4, b: 0.5, c: 2.0 },
  baxendell: { a: 9.56, b: 0.546, c: 1.93 },
  achong: { a: 3.82, b: 0.65, c: 1.88 },
};

export interface ChokeInput {
  qStbd: number;
  glr: number;       // scf/STB
  diameter64: number; // 1/64 in (típico 8–128)
  correlation?: ChokeCorrelation;
}

/** Pwh upstream del choke (psi). */
export function chokePressure(input: ChokeInput): number {
  const { qStbd, glr, diameter64, correlation = "gilbert" } = input;
  const c = COEFFS[correlation];
  // Forma generalizada: Pwh = (a · R^b · Q) / D^c · 43.5  (factor calibrado a Gilbert clásico)
  // Para Gilbert tradicional el coeficiente combinado es 435 (a=10, ×43.5)
  return (c.a * 43.5 * Math.pow(glr, c.b) * qStbd) / Math.pow(diameter64, c.c);
}

/** Curva de Pwh vs Q para varios diámetros de choke. */
export function chokeFamily(
  diameters64: number[],
  qMax: number,
  glr: number,
  correlation: ChokeCorrelation = "gilbert"
): Array<{ d: number; points: { q: number; pwh: number }[] }> {
  const N = 25;
  return diameters64.map((d) => {
    const points: { q: number; pwh: number }[] = [];
    for (let i = 1; i <= N; i++) {
      const q = (qMax * i) / N;
      points.push({ q, pwh: chokePressure({ qStbd: q, glr, diameter64: d, correlation }) });
    }
    return { d, points };
  });
}
