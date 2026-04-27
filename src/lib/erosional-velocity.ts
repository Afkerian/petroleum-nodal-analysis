/**
 * Velocidad erosional según API RP 14E.
 *
 *   v_e = c / √ρ_m
 *
 * Donde:
 *   c = 100 ft/s · √(lb/ft³)  para servicio continuo (acero al carbono limpio)
 *   c = 125 para servicio intermitente
 *   c < 100 si hay sólidos (arena) — hasta c=50 conservador.
 *
 * Si v_actual > v_e, la línea sufre erosión inaceptable. Es chequeo estándar
 * para diseño de tubings, líneas de flujo y manifolds.
 */

export interface ErosionalInput {
  rhoMixLbFt3: number;
  velocityFtS: number;
  tubingIdIn: number;
  cFactor?: number; // default 100 (continuous service)
}

export interface ErosionalResult {
  vErosional: number;
  status: "ok" | "warning" | "exceeded";
  marginPct: number;
  qErosionalBpd: number;
  qErosionalMMscfd: number;
}

export function erosionalCheck(input: ErosionalInput): ErosionalResult {
  const { rhoMixLbFt3, velocityFtS, tubingIdIn, cFactor = 100 } = input;
  const rho = Math.max(rhoMixLbFt3, 0.01);
  const vE = cFactor / Math.sqrt(rho);
  const dFt = tubingIdIn / 12;
  const A = (Math.PI / 4) * dFt * dFt;
  // Caudales críticos a las condiciones actuales (sirve para etiquetar el chart)
  const qFt3PerSec = vE * A;
  // BPD (líquido) = ft³/s · 86400 / 5.615
  const qBpd = (qFt3PerSec * 86400) / 5.615;
  // MMscfd (gas) si aplica — el llamador hace la conversión usando Bg propia
  const qMMscfd = (qFt3PerSec * 86400) / 1e6;

  const ratio = velocityFtS / vE;
  let status: "ok" | "warning" | "exceeded";
  if (ratio > 1.0) status = "exceeded";
  else if (ratio > 0.8) status = "warning";
  else status = "ok";

  return {
    vErosional: vE,
    status,
    marginPct: (1 - ratio) * 100,
    qErosionalBpd: qBpd,
    qErosionalMMscfd: qMMscfd,
  };
}
