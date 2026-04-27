/**
 * Balance de materia simple para reservorios de gas — método P/Z vs Gp.
 *
 * Para un reservorio volumétrico (sin influjo de agua):
 *   P/Z = (Pi/Zi) · (1 − Gp/G)
 *
 * Graficar P/Z vs Gp da una recta. La intersección con P/Z=0 es el OGIP (G).
 * La intersección con la abandono-pressure da las reservas recuperables.
 *
 * Para datos observados [(Pi, Gpi)], esta función:
 *   1. Calcula Z para cada P con DAK.
 *   2. Hace regresión lineal para extrapolar OGIP.
 *   3. Devuelve también la curva teórica.
 */
import { PVT } from "./pvt-correlations";

export interface MBPoint {
  p: number;     // psia
  gp: number;    // Bcf (cumulative produced)
}

export interface MBInput {
  observations: MBPoint[];
  gasSg: number;
  tempF: number;
  pAbandonment: number;
}

export interface MBResult {
  oogipBcf: number;        // billion scf — original gas in place (extrapolado)
  recoverableBcf: number;
  recoveryFactor: number;  // 0..1
  slope: number;
  intercept: number;
  fitR2: number;
  curve: { gp: number; pz: number; pzObs?: number }[];
}

export function gasMaterialBalance(input: MBInput): MBResult {
  const { observations, gasSg, tempF, pAbandonment } = input;
  const pPc = 756.8 - 131 * gasSg;
  const tPc = 169.2 + 349.5 * gasSg;
  const tR = tempF + 460;
  const tpr = tR / tPc;

  const obs = observations.map((o) => {
    const z = PVT.zFactorDAK(o.p / pPc, tpr);
    return { gp: o.gp, p: o.p, z, pz: o.p / z };
  });

  // Regresión lineal: P/Z = a + b·Gp
  const n = obs.length;
  if (n < 2) {
    return {
      oogipBcf: 0,
      recoverableBcf: 0,
      recoveryFactor: 0,
      slope: 0,
      intercept: 0,
      fitR2: 0,
      curve: [],
    };
  }
  const meanX = obs.reduce((s, o) => s + o.gp, 0) / n;
  const meanY = obs.reduce((s, o) => s + o.pz, 0) / n;
  const num = obs.reduce((s, o) => s + (o.gp - meanX) * (o.pz - meanY), 0);
  const den = obs.reduce((s, o) => s + Math.pow(o.gp - meanX, 2), 0) || 1;
  const slope = num / den;
  const intercept = meanY - slope * meanX;
  const ssRes = obs.reduce(
    (s, o) => s + Math.pow(o.pz - (intercept + slope * o.gp), 2),
    0
  );
  const ssTot = obs.reduce((s, o) => s + Math.pow(o.pz - meanY, 2), 0) || 1;
  const r2 = 1 - ssRes / ssTot;

  // Gp cuando P/Z = 0  →  Gp_max = -intercept/slope
  const oogip = slope < 0 ? -intercept / slope : 0;

  // Reservas recuperables hasta P_abandono
  const zAban = PVT.zFactorDAK(pAbandonment / pPc, tpr);
  const pzAban = pAbandonment / zAban;
  const gpAban = slope < 0 ? (pzAban - intercept) / slope : oogip;
  const recoverable = Math.max(0, gpAban);

  // Curva teórica + observaciones
  const gpMax = Math.max(oogip * 1.1, ...obs.map((o) => o.gp));
  const N = 30;
  const obsMap = new Map(obs.map((o) => [+o.gp.toFixed(4), o.pz]));
  const curve: { gp: number; pz: number; pzObs?: number }[] = [];
  for (let i = 0; i <= N; i++) {
    const gp = (gpMax * i) / N;
    curve.push({ gp, pz: Math.max(0, intercept + slope * gp) });
  }
  for (const o of obs) {
    curve.push({ gp: o.gp, pz: o.pz, pzObs: o.pz });
  }
  curve.sort((a, b) => a.gp - b.gp);

  return {
    oogipBcf: oogip,
    recoverableBcf: recoverable,
    recoveryFactor: oogip > 0 ? recoverable / oogip : 0,
    slope,
    intercept,
    fitR2: r2,
    curve,
    // hint para el chart
    ...({ obsMap } as Record<string, unknown>),
  };
}
