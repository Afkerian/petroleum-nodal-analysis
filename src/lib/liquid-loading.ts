/**
 * Liquid loading en pozos de gas — criterios de Turner (1969) y Coleman (1991).
 *
 * Cuando la velocidad superficial del gas cae por debajo de un valor crítico,
 * las gotas de líquido caen por gravedad y se acumulan en el fondo, "ahogando"
 * el pozo. Saberlo es esencial para sizing de tubing y planeación de operación.
 *
 *   Turner   v_c = 1.92·[σ·(ρL − ρG) / ρG²]^0.25     (incluye factor de seguridad 1.2)
 *   Coleman  v_c = 0.7 · v_Turner                     (sin factor de seguridad)
 *
 * Caudal crítico (MMscfd):
 *   q_c = (3.06 · v_c · A · P) / (T · Z)
 * con A en ft², P en psia, T en °R, v_c en ft/s.
 */
import { PVT } from "./pvt-correlations";

export interface LiquidLoadingInput {
  pwh: number;        // psia
  tempWhF: number;    // °F
  tubingIdIn: number; // in
  gasSg: number;
  rhoLiquid?: number; // lb/ft³ — water=62.4, condensate~50
  surfaceTension?: number; // dyne/cm — water≈60, condensate≈20
}

export interface LiquidLoadingResult {
  vcTurner: number;   // ft/s
  vcColeman: number;
  qcTurnerMMscfd: number;
  qcColemanMMscfd: number;
  rhoG: number;
  z: number;
}

export function liquidLoading(input: LiquidLoadingInput): LiquidLoadingResult {
  const {
    pwh,
    tempWhF,
    tubingIdIn,
    gasSg,
    rhoLiquid = 62.4,
    surfaceTension = 60,
  } = input;

  const tR = tempWhF + 460;
  const pPc = 756.8 - 131 * gasSg;
  const tPc = 169.2 + 349.5 * gasSg;
  const ppr = pwh / pPc;
  const tpr = tR / tPc;
  const z = PVT.zFactorDAK(ppr, tpr);

  // Densidad del gas a Pwh, T_wh — ρ = P·M / (Z·R·T_R), M = 28.96·γg
  const rhoG = (pwh * 28.96 * gasSg) / (z * 10.73 * tR);

  // Conversión de tensión superficial: 1 dyne/cm = 6.852e-5 lbf/ft → para la
  // forma de Turner ya tabulada, usamos σ en dyne/cm y la constante 1.92 que
  // hereda esas unidades.
  const sigma = Math.max(surfaceTension, 1);
  const deltaRho = Math.max(rhoLiquid - rhoG, 0.1);
  const vcTurner = 1.92 * Math.pow((sigma * deltaRho) / (rhoG * rhoG), 0.25);
  const vcColeman = 0.7 * vcTurner;

  const dFt = tubingIdIn / 12;
  const A = (Math.PI / 4) * dFt * dFt;
  // q [MMscfd] = 3.06 · v · A · P / (T_R · Z)  con v en ft/s, A en ft², P en psia
  const qcTurner = (3.06 * vcTurner * A * pwh) / (tR * z);
  const qcColeman = (3.06 * vcColeman * A * pwh) / (tR * z);

  return {
    vcTurner,
    vcColeman,
    qcTurnerMMscfd: qcTurner,
    qcColemanMMscfd: qcColeman,
    rhoG,
    z,
  };
}
