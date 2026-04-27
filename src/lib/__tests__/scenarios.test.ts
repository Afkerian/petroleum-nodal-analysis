import { beforeEach, describe, expect, test } from "vitest";
import {
  deleteScenario,
  listScenarios,
  loadScenario,
  saveScenario,
} from "@/lib/scenarios";

// Polyfill localStorage for node test env
class LocalStorageMock {
  private store = new Map<string, string>();
  getItem(k: string) {
    return this.store.has(k) ? (this.store.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    this.store.set(k, v);
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
}

beforeEach(() => {
  // @ts-expect-error attach mock
  globalThis.window = { localStorage: new LocalStorageMock() };
});

describe("scenarios persistence", () => {
  test("save and load roundtrip", () => {
    saveScenario("vlp", "Cusiana", { depth: 8000, gor: 800 });
    const v = loadScenario<{ depth: number; gor: number }>("vlp", "Cusiana");
    expect(v?.depth).toBe(8000);
    expect(v?.gor).toBe(800);
  });

  test("listScenarios returns sorted names", () => {
    saveScenario("vlp", "B", { x: 1 });
    saveScenario("vlp", "A", { x: 2 });
    expect(listScenarios("vlp")).toEqual(["A", "B"]);
  });

  test("deleteScenario removes the entry", () => {
    saveScenario("vlp", "X", { y: 1 });
    deleteScenario("vlp", "X");
    expect(loadScenario("vlp", "X")).toBeNull();
  });

  test("empty name is ignored", () => {
    saveScenario("vlp", "  ", { x: 1 });
    expect(listScenarios("vlp")).not.toContain("  ");
  });
});
