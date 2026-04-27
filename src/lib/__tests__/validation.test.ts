import { describe, expect, test } from "vitest";
import { validateInputs } from "@/lib/validation";

describe("validation", () => {
  test("flags out-of-range API", () => {
    const issues = validateInputs({ api: -5 });
    expect(issues.find((i) => i.field === "api")).toBeDefined();
  });

  test("flags BSW > 100", () => {
    const issues = validateInputs({ bsw: 110 });
    expect(issues.find((i) => i.field === "bsw")).toBeDefined();
  });

  test("flags T_bh ≤ T_wh", () => {
    const issues = validateInputs({ twh: 200, tbh: 150 });
    expect(issues.some((i) => i.message.includes("T_fondo"))).toBe(true);
  });

  test("clean inputs produce no warnings", () => {
    const issues = validateInputs({
      api: 30,
      bsw: 10,
      gor: 800,
      tid: 2.441,
      depth: 8000,
      pwh: 150,
      pres: 3000,
      qmax: 6774,
      twh: 100,
      tbh: 200,
      gsg: 0.75,
      wsg: 1.02,
    });
    expect(issues.length).toBe(0);
  });
});
