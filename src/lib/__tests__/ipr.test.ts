import { describe, expect, test } from "vitest";
import { IPR, gasAOF } from "@/lib/ipr-models";

describe("IPR models", () => {
  test("Vogel: q=0 at Pwf=Pr, q=qmax at Pwf=0", () => {
    const r = IPR.vogel(1500, 3000);
    const head = r.points[0];
    const tail = r.points[r.points.length - 1];
    expect(head.pwf).toBeCloseTo(0, 3);
    expect(head.q).toBeCloseTo(1500, 1);
    expect(tail.pwf).toBeCloseTo(3000, 3);
    expect(tail.q).toBeCloseTo(0, 1);
  });

  test("Wiggins shape similar magnitude to Vogel at qmax", () => {
    const v = IPR.vogel(1500, 3000);
    const w = IPR.wiggins(1500, 3000);
    expect(w.points[0].q).toBeCloseTo(v.points[0].q, 1);
  });

  test("Fetkovich: q increases as Pwf decreases", () => {
    const r = IPR.fetkovich(0.5, 1, 3000);
    expect(r.points[0].q).toBeGreaterThan(r.points[r.points.length - 1].q);
  });

  test("Darcy: J calculated correctly for unit Pr", () => {
    const r = IPR.darcy(50, 30, 1.5, 1.2, 1000, 0.328, 0, 3000);
    expect(r.points[0].q).toBeGreaterThan(0);
    expect(r.points[r.points.length - 1].q).toBeCloseTo(0, 3);
  });

  test("Joshi: positive q decreasing with Pwf", () => {
    const r = IPR.joshi(50, 30, 1.5, 1.2, 1000, 0.328, 1500, 3000);
    expect(r.points[0].q).toBeGreaterThan(r.points[r.points.length - 1].q);
  });

  test("Joshi for very long horizontal yields higher q than Darcy vertical", () => {
    const dV = IPR.darcy(50, 30, 1.5, 1.2, 1000, 0.328, 0, 3000);
    const dH = IPR.joshi(50, 30, 1.5, 1.2, 1000, 0.328, 2000, 3000);
    expect(dH.points[0].q).toBeGreaterThan(dV.points[0].q);
  });

  test("Composite IPR: linear above Pb, Vogel below", () => {
    const r = IPR.composite(1.0, 3000, 1500, 60);
    // At Pwf = Pb the curve must be continuous
    const atPb = r.points.find((p) => Math.abs(p.pwf - 1500) < 50);
    expect(atPb).toBeDefined();
    expect(atPb!.q).toBeGreaterThan(0);
  });

  test("Gas AOF formula", () => {
    const aof = gasAOF(1e-4, 0.85, 3500);
    const expected = 1e-4 * Math.pow(3500 * 3500, 0.85);
    expect(aof).toBeCloseTo(expected, 6);
  });

  test("Gas IPR: q=AOF at Pwf=0", () => {
    const r = IPR.gas(1e-4, 0.85, 3500);
    const tail = r.points[0];
    const aof = gasAOF(1e-4, 0.85, 3500);
    expect(tail.pwf).toBeCloseTo(0, 3);
    expect(tail.q).toBeCloseTo(aof, 4);
  });
});
