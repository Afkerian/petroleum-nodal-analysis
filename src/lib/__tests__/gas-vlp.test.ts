import { describe, expect, test } from "vitest";
import { calculateGasPwf } from "@/lib/gas-vlp";

describe("Gas VLP — Cullender-Smith style", () => {
  const base = {
    lengthFt: 8000,
    tubingIdIn: 2.441,
    pWh: 800,
    tempWhF: 100,
    tempBhF: 200,
    qGasMMscfd: 5,
    gasSg: 0.7,
  };

  test("returns finite Pwf > Pwh for nominal input", () => {
    const r = calculateGasPwf(base);
    expect(Number.isFinite(r.pwf)).toBe(true);
    expect(r.pwf).toBeGreaterThan(base.pWh);
  });

  test("Pwf increases with depth", () => {
    const a = calculateGasPwf(base);
    const b = calculateGasPwf({ ...base, lengthFt: 12000 });
    expect(b.pwf).toBeGreaterThan(a.pwf);
  });

  test("Pwf increases with rate (more friction)", () => {
    const lo = calculateGasPwf({ ...base, qGasMMscfd: 1 });
    const hi = calculateGasPwf({ ...base, qGasMMscfd: 20 });
    expect(hi.pwf).toBeGreaterThan(lo.pwf);
  });

  test("converges within 60 iterations", () => {
    const r = calculateGasPwf(base);
    expect(r.iterations).toBeLessThanOrEqual(60);
  });
});
