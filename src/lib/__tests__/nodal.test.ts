import { describe, expect, test } from "vitest";
import { findOperatingPoint } from "@/lib/nodal";
import { IPR } from "@/lib/ipr-models";
import { calculatePwf31 } from "@/lib/vlp-models";

describe("Operating point", () => {
  test("finds intersection for nominal Vogel + Poettmann scenario", () => {
    const ipr = IPR.vogel(6774, 3000, 60).points;
    const vlp: { q: number; pwf: number }[] = [];
    const qMax = 6774;
    for (let i = 0; i < 18; i++) {
      const q = 100 + ((qMax - 100) * i) / 17;
      const r = calculatePwf31({
        lengthFt: 8000,
        tubingIdIn: 2.441,
        pWh: 150,
        tempWhF: 100,
        tempBhF: 200,
        qLiqBpd: q,
        gor: 800,
        bsw: 10,
        api: 30,
        gasSg: 0.75,
        waterSg: 1.02,
        bw: 1.0,
      });
      vlp.push({ q, pwf: r.pwf });
    }
    const op = findOperatingPoint(ipr, vlp);
    expect(op).not.toBeNull();
    expect(op!.q).toBeGreaterThan(0);
    expect(op!.pwf).toBeGreaterThan(0);
    expect(op!.pwf).toBeLessThan(3000);
  });

  test("returns null for non-overlapping ranges", () => {
    const a = [{ q: 0, pwf: 100 }, { q: 100, pwf: 200 }];
    const b = [{ q: 200, pwf: 100 }, { q: 300, pwf: 200 }];
    expect(findOperatingPoint(a, b)).toBeNull();
  });
});
