import { describe, expect, test } from "vitest";
import { dunsRos } from "@/lib/duns-ros";

const base = {
  vsl: 1.0,
  vsg: 1.0,
  rhoL: 50,
  rhoG: 5,
  muL: 1.0,
  muG: 0.02,
  sigma: 30,
  tubingIdIn: 2.441,
};

describe("Duns-Ros pattern + gradient", () => {
  test("returns finite gradient and dimensionless numbers", () => {
    const r = dunsRos(base);
    expect(Number.isFinite(r.gradient)).toBe(true);
    expect(r.gradient).toBeGreaterThan(0);
    expect(r.numbers.Nvs).toBeGreaterThan(0);
    expect(r.numbers.Nvg).toBeGreaterThan(0);
  });

  test("region I (bubble) for low VSG, high VSL", () => {
    const r = dunsRos({ ...base, vsl: 5, vsg: 0.05 });
    expect(["I", "II"]).toContain(r.region);
  });

  test("region III (mist) for very high VSG, low VSL", () => {
    const r = dunsRos({ ...base, vsl: 0.05, vsg: 100 });
    expect(["III", "T"]).toContain(r.region);
  });

  test("holdup ≥ no-slip lambda", () => {
    const r = dunsRos(base);
    const lambda = base.vsl / (base.vsl + base.vsg);
    expect(r.hl).toBeGreaterThanOrEqual(lambda - 1e-6);
  });
});
