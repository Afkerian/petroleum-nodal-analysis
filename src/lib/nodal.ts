/**
 * Análisis nodal — utilidades de intersección y muestreo de curvas.
 *
 * Las curvas IPR y VLP son discretas (arrays de puntos). Para encontrar la
 * intersección numérica las interpolamos linealmente y resolvemos
 * f(q) = pwf_IPR(q) - pwf_VLP(q) = 0 por bisección sobre el rango común
 * de caudales. Cuando hay más de un cruce, devolvemos el de mayor caudal
 * (el "punto de operación" físico — IPR decrece, VLP crece).
 */

export interface XYPoint {
  q: number;
  pwf: number;
}

export interface OperatingPoint {
  q: number;
  pwf: number;
}

const interpolate = (points: XYPoint[], q: number): number | null => {
  if (points.length === 0) return null;
  const sorted = [...points].sort((a, b) => a.q - b.q);
  if (q < sorted[0].q || q > sorted[sorted.length - 1].q) return null;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (q >= a.q && q <= b.q) {
      if (b.q === a.q) return a.pwf;
      const t = (q - a.q) / (b.q - a.q);
      return a.pwf + t * (b.pwf - a.pwf);
    }
  }
  return null;
};

const bisection = (
  f: (q: number) => number,
  qLo: number,
  qHi: number,
  tol = 1e-3,
  maxIter = 80
): number | null => {
  let fLo = f(qLo);
  let fHi = f(qHi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi)) return null;
  if (fLo * fHi > 0) return null;
  let lo = qLo;
  let hi = qHi;
  for (let i = 0; i < maxIter; i++) {
    const mid = 0.5 * (lo + hi);
    const fMid = f(mid);
    if (!Number.isFinite(fMid)) return null;
    if (Math.abs(fMid) < tol || hi - lo < tol) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return 0.5 * (lo + hi);
};

/**
 * Encuentra la intersección de la curva IPR (oferta) con la VLP (demanda).
 * Estrategia: muestreamos `nSamples` caudales en el rango común y buscamos
 * cambios de signo de g(q) = pwf_IPR(q) - pwf_VLP(q). Para cada cambio de
 * signo aplicamos bisección. Devolvemos el cruce de mayor caudal (punto
 * estable de operación cuando IPR es decreciente y VLP creciente).
 */
export function findOperatingPoint(
  ipr: XYPoint[],
  vlp: XYPoint[],
  nSamples = 200
): OperatingPoint | null {
  if (ipr.length < 2 || vlp.length < 2) return null;

  const iprQs = ipr.map((p) => p.q);
  const vlpQs = vlp.map((p) => p.q);
  const qLo = Math.max(Math.min(...iprQs), Math.min(...vlpQs));
  const qHi = Math.min(Math.max(...iprQs), Math.max(...vlpQs));
  if (qHi <= qLo) return null;

  const g = (q: number): number => {
    const a = interpolate(ipr, q);
    const b = interpolate(vlp, q);
    if (a === null || b === null) return Number.NaN;
    return a - b;
  };

  const dq = (qHi - qLo) / (nSamples - 1);
  const crossings: number[] = [];
  let prevQ = qLo;
  let prevG = g(prevQ);

  for (let i = 1; i < nSamples; i++) {
    const q = qLo + dq * i;
    const gQ = g(q);
    if (Number.isFinite(prevG) && Number.isFinite(gQ) && prevG * gQ < 0) {
      const root = bisection(g, prevQ, q);
      if (root !== null) crossings.push(root);
    }
    prevQ = q;
    prevG = gQ;
  }

  if (crossings.length === 0) return null;

  const qStar = crossings[crossings.length - 1];
  const pwfIpr = interpolate(ipr, qStar);
  const pwfVlp = interpolate(vlp, qStar);
  if (pwfIpr === null || pwfVlp === null) return null;
  return { q: qStar, pwf: 0.5 * (pwfIpr + pwfVlp) };
}
