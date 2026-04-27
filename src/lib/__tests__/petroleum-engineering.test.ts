import { describe, expect, test } from "vitest";
import { liquidLoading } from "@/lib/liquid-loading";
import { erosionalCheck } from "@/lib/erosional-velocity";
import { arpsDecline } from "@/lib/decline-curve";
import { gasMaterialBalance } from "@/lib/material-balance";
import { chokeFamily, chokePressure } from "@/lib/choke";
import {
  skinHawkins,
  skinPartialPenetration,
  skinPerforation,
  skinDeviation,
  skinTotal,
} from "@/lib/skin";
import {
  hammerschmidtDeltaT,
  hydrateAtConditions,
  hydrateTemperatureF,
} from "@/lib/hydrate";
import { sandPrediction } from "@/lib/sand-prediction";
import { PVT } from "@/lib/pvt-correlations";

describe("Liquid loading (Turner / Coleman)", () => {
  test("Coleman is 70% of Turner", () => {
    const r = liquidLoading({
      pwh: 800, tempWhF: 100, tubingIdIn: 2.441, gasSg: 0.7,
    });
    expect(r.vcColeman).toBeCloseTo(r.vcTurner * 0.7, 6);
    expect(r.qcTurnerMMscfd).toBeGreaterThan(0);
    expect(r.qcColemanMMscfd).toBeLessThan(r.qcTurnerMMscfd);
  });

  test("Larger ID gives larger critical rate", () => {
    const small = liquidLoading({ pwh: 800, tempWhF: 100, tubingIdIn: 1.5, gasSg: 0.7 });
    const big = liquidLoading({ pwh: 800, tempWhF: 100, tubingIdIn: 4.0, gasSg: 0.7 });
    expect(big.qcTurnerMMscfd).toBeGreaterThan(small.qcTurnerMMscfd);
  });
});

describe("Erosional velocity (API RP 14E)", () => {
  test("v_e = c/√ρ", () => {
    const r = erosionalCheck({ rhoMixLbFt3: 25, velocityFtS: 5, tubingIdIn: 2.5, cFactor: 100 });
    expect(r.vErosional).toBeCloseTo(100 / Math.sqrt(25), 4);
  });

  test("Status flagged when v exceeds limit", () => {
    const r = erosionalCheck({ rhoMixLbFt3: 1, velocityFtS: 200, tubingIdIn: 2.5, cFactor: 100 });
    expect(r.status).toBe("exceeded");
  });
});

describe("Arps decline (exponential, hyperbolic, harmonic)", () => {
  test("Exponential q halves at t = ln(2)/Di", () => {
    const r = arpsDecline({
      qi: 1000, diYearly: 0.5, qAbandon: 1, years: 10, kind: "exponential", b: 0,
    });
    const halfTime = Math.log(2) / 0.5;
    const closest = r.series.reduce((best, p) => Math.abs(p.year - halfTime) < Math.abs(best.year - halfTime) ? p : best);
    // Tolerance ±15 STB/d due to monthly discretization (dt = 1/12 yr)
    expect(Math.abs(closest.q - 500)).toBeLessThan(20);
  });

  test("Cumulative is monotonic", () => {
    const r = arpsDecline({ qi: 1000, diYearly: 0.2, b: 0.5, qAbandon: 10, years: 20, kind: "hyperbolic" });
    for (let i = 1; i < r.series.length; i++) {
      expect(r.series[i].cumStb).toBeGreaterThanOrEqual(r.series[i - 1].cumStb);
    }
  });

  test("Harmonic decline is slowest", () => {
    const exp = arpsDecline({ qi: 1000, diYearly: 0.3, qAbandon: 1, years: 10, kind: "exponential" });
    const harm = arpsDecline({ qi: 1000, diYearly: 0.3, qAbandon: 1, years: 10, kind: "harmonic" });
    expect(harm.eur).toBeGreaterThan(exp.eur);
  });
});

describe("Material balance (P/Z linear regression)", () => {
  test("Perfect linear data recovers OGIP", () => {
    // Construir observaciones sintéticas: P/Z = 5000 - 100·Gp → OGIP = 50 Bcf
    const tempF = 200;
    const gasSg = 0.7;
    const tPc = 169.2 + 349.5 * gasSg;
    const pPc = 756.8 - 131 * gasSg;
    const tpr = (tempF + 460) / tPc;
    const observations = [0, 5, 10, 15, 20, 25].map((gp) => {
      const pz = 5000 - 100 * gp;
      // Find P such that P/Z = pz → iterate
      let p = pz;
      for (let i = 0; i < 30; i++) {
        const z = PVT.zFactorDAK(p / pPc, tpr);
        p = pz * z;
      }
      return { p, gp };
    });
    const r = gasMaterialBalance({ observations, gasSg, tempF, pAbandonment: 500 });
    expect(r.oogipBcf).toBeGreaterThan(40);
    expect(r.oogipBcf).toBeLessThan(60);
    expect(r.fitR2).toBeGreaterThan(0.99);
  });
});

describe("Choke (Gilbert family)", () => {
  test("Pwh decreases as choke diameter grows", () => {
    const small = chokePressure({ qStbd: 1000, glr: 600, diameter64: 16 });
    const big = chokePressure({ qStbd: 1000, glr: 600, diameter64: 64 });
    expect(big).toBeLessThan(small);
  });

  test("chokeFamily returns sorted positive Pwh", () => {
    const fam = chokeFamily([16, 32, 64], 1000, 600);
    for (const f of fam) {
      expect(f.points.length).toBeGreaterThan(0);
      expect(f.points.every((p) => p.pwh >= 0)).toBe(true);
    }
  });
});

describe("Skin components", () => {
  test("Hawkins: positive when k_dam < k_form", () => {
    const s = skinHawkins({ kFormation: 50, kDamaged: 5, rDamaged: 2.5, rWell: 0.328 });
    expect(s).toBeGreaterThan(0);
  });

  test("Hawkins: negative when k_dam > k_form (stim)", () => {
    const s = skinHawkins({ kFormation: 50, kDamaged: 200, rDamaged: 5, rWell: 0.328 });
    expect(s).toBeLessThan(0);
  });

  test("Partial penetration: zero when fully penetrated", () => {
    const s = skinPartialPenetration({ hPenetrated: 30, hReservoir: 30, rWell: 0.328 });
    expect(s).toBe(0);
  });

  test("Deviation: more inclined → more negative skin", () => {
    const s0 = skinDeviation({ inclinationDeg: 0, hReservoir: 30, rWell: 0.328 });
    const s60 = skinDeviation({ inclinationDeg: 60, hReservoir: 30, rWell: 0.328 });
    expect(s60).toBeLessThan(s0);
  });

  test("Total = sum of components", () => {
    const t = skinTotal({ hawkins: 3, partial: 1, perforation: -0.5, deviation: -2 });
    expect(t.total).toBe(1.5);
  });

  test("Perforation skin defined for typical SPF", () => {
    const s = skinPerforation({ shotsPerFt: 12, perfLengthIn: 10, perfDiameterIn: 0.4, rWell: 0.328 });
    expect(Number.isFinite(s)).toBe(true);
  });
});

describe("Hydrates", () => {
  test("Higher pressure → higher T_hyd", () => {
    const tLow = hydrateTemperatureF({ pressurePsi: 200, gasSg: 0.7 });
    const tHigh = hydrateTemperatureF({ pressurePsi: 2000, gasSg: 0.7 });
    expect(tHigh).toBeGreaterThan(tLow);
  });

  test("Hammerschmidt ΔT positive and monotonic in concentration", () => {
    const dt10 = hammerschmidtDeltaT("methanol", 10);
    const dt30 = hammerschmidtDeltaT("methanol", 30);
    expect(dt30).toBeGreaterThan(dt10);
    expect(dt10).toBeGreaterThan(0);
  });

  test("Methanol depresses more than TEG at same concentration", () => {
    const meoh = hammerschmidtDeltaT("methanol", 30);
    const teg = hammerschmidtDeltaT("TEG", 30);
    expect(meoh).toBeGreaterThan(teg);
  });

  test("Risk classification works", () => {
    const r = hydrateAtConditions(2000, 30, 0.7);
    expect(["safe", "watch", "risk"]).toContain(r.risk);
  });
});

describe("Sand prediction", () => {
  test("Higher UCS → higher critical drawdown", () => {
    const weak = sandPrediction({ ucsPsi: 500, poisson: 0.25, drawdownPsi: 100 });
    const strong = sandPrediction({ ucsPsi: 5000, poisson: 0.25, drawdownPsi: 100 });
    expect(strong.drawdownCritical).toBeGreaterThan(weak.drawdownCritical);
  });

  test("Risk when drawdown exceeds critical", () => {
    const r = sandPrediction({ ucsPsi: 500, poisson: 0.25, drawdownPsi: 5000 });
    expect(r.status).toBe("risk");
  });
});

describe("Vazquez-Beggs Pb (after bug fix)", () => {
  test("Returns finite result and consistent with Rs forward calculation", () => {
    const Rs = 600;
    const Pb = PVT.pbVazquezBeggs(Rs, 0.75, 30, 180);
    const RsBack = PVT.rsVazquezBeggs(Pb, 0.75, 30, 180);
    expect(Pb).toBeGreaterThan(100);
    expect(RsBack).toBeCloseTo(Rs, 0);
  });
});
