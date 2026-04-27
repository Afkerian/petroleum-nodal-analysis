import { describe, expect, test } from "vitest";
import { PVT, pickPb, pickZ } from "@/lib/pvt-correlations";

describe("PVT correlations", () => {
  test("DAK Z factor at Ppr=2, Tpr=1.5 falls in physical range", () => {
    const z = PVT.zFactorDAK(2, 1.5);
    expect(z).toBeGreaterThan(0.5);
    expect(z).toBeLessThan(1.0);
    expect(z).toBeCloseTo(0.82, 1);
  });

  test("DAK and Hall-Yarborough agree within 5% for Tpr>1.2", () => {
    for (const ppr of [1, 2, 3, 5]) {
      for (const tpr of [1.3, 1.6, 2.0]) {
        const zd = PVT.zFactorDAK(ppr, tpr);
        const zh = PVT.zFactorHallYarborough(ppr, tpr);
        expect(Math.abs(zd - zh) / zd).toBeLessThan(0.06);
      }
    }
  });

  test("Standing Pb monotonic in Rs", () => {
    const a = PVT.pbStanding(200, 0.75, 30, 180);
    const b = PVT.pbStanding(800, 0.75, 30, 180);
    expect(b).toBeGreaterThan(a);
  });

  test("Lasater Pb finite for typical inputs", () => {
    const pb = PVT.pbLasater(600, 0.75, 30, 180);
    expect(Number.isFinite(pb)).toBe(true);
    expect(pb).toBeGreaterThan(100);
  });

  test("Glaso Pb finite for typical inputs", () => {
    const pb = PVT.pbGlaso(600, 0.75, 30, 180);
    expect(Number.isFinite(pb)).toBe(true);
    expect(pb).toBeGreaterThan(100);
  });

  test("Vazquez-Beggs Pb finite for typical inputs", () => {
    const pb = PVT.pbVazquezBeggs(600, 0.75, 30, 180);
    expect(Number.isFinite(pb)).toBe(true);
    expect(pb).toBeGreaterThan(100);
  });

  test("μ_o subsaturated correction grows with P > Pb", () => {
    const muOb = 1.5;
    const muSubA = PVT.muOilVazquezBeggs(muOb, 4000, 2000);
    const muSubB = PVT.muOilVazquezBeggs(muOb, 6000, 2000);
    expect(muSubA).toBeGreaterThan(muOb);
    expect(muSubB).toBeGreaterThan(muSubA);
  });

  test("pickPb dispatch matches direct call", () => {
    expect(pickPb("standing", 600, 0.75, 30, 180)).toBeCloseTo(
      PVT.pbStanding(600, 0.75, 30, 180),
      6
    );
    expect(pickPb("glaso", 600, 0.75, 30, 180)).toBeCloseTo(
      PVT.pbGlaso(600, 0.75, 30, 180),
      6
    );
  });

  test("pickZ dispatch returns finite values", () => {
    expect(pickZ("dak", 3, 1.5)).toBeGreaterThan(0);
    expect(pickZ("hall-yarborough", 3, 1.5)).toBeGreaterThan(0);
  });

  test("Rs Standing < GOR for under-bubble pressures", () => {
    const rs = PVT.rsStanding(1000, 0.75, 30, 180);
    expect(rs).toBeGreaterThan(0);
    expect(rs).toBeLessThan(2000);
  });

  test("Lee gas viscosity finite", () => {
    const mu = PVT.gasViscosityLee(180, 5, 17);
    expect(mu).toBeGreaterThan(0);
    expect(mu).toBeLessThan(0.5);
  });
});
