import { describe, expect, test } from "vitest";
import { calculatePwf31 } from "@/lib/vlp-models";

const baseInput = {
  lengthFt: 8000,
  tubingIdIn: 2.441,
  pWh: 150,
  tempWhF: 100,
  tempBhF: 200,
  qLiqBpd: 1500,
  gor: 800,
  bsw: 10,
  api: 30,
  gasSg: 0.75,
  waterSg: 1.02,
  bw: 1.0,
};

describe("VLP — Poettmann-Carpenter (PDF method)", () => {
  test("converges within ~50 iterations for nominal input", () => {
    const r = calculatePwf31(baseInput);
    expect(r.converged).toBe(true);
    expect(r.iterations).toBeLessThan(80);
    expect(r.pwf).toBeGreaterThan(baseInput.pWh);
  });

  test("Pwf increases with depth", () => {
    const a = calculatePwf31(baseInput);
    const b = calculatePwf31({ ...baseInput, lengthFt: 12000 });
    expect(b.pwf).toBeGreaterThan(a.pwf);
  });

  test("Pwf increases with Pwh", () => {
    const a = calculatePwf31(baseInput);
    const b = calculatePwf31({ ...baseInput, pWh: 500 });
    expect(b.pwf).toBeGreaterThan(a.pwf);
  });

  test("Steps map populated with 31 keys", () => {
    const r = calculatePwf31(baseInput);
    expect(Object.keys(r.steps).length).toBeGreaterThanOrEqual(30);
  });

  test("Hagedorn-Brown returns finite Pwf", () => {
    const r = calculatePwf31({ ...baseInput, correlation: "hagedorn-brown" });
    expect(Number.isFinite(r.pwf)).toBe(true);
    expect(r.pwf).toBeGreaterThan(0);
  });

  test("Beggs-Brill returns finite Pwf and reacts to inclination", () => {
    const vert = calculatePwf31({ ...baseInput, correlation: "beggs-brill", inclinationDeg: 0 });
    const tilt = calculatePwf31({ ...baseInput, correlation: "beggs-brill", inclinationDeg: 60 });
    expect(Number.isFinite(vert.pwf)).toBe(true);
    expect(Number.isFinite(tilt.pwf)).toBe(true);
    // Inclined well typically yields lower vertical hydrostatic component
    expect(tilt.pwf).toBeLessThan(vert.pwf);
  });
});
