/**
 * Sistema de escenarios nombrados. Guarda/carga/elimina configuraciones
 * de un formulario por nombre. Cada "key" identifica un tipo de escenario
 * (vlp, ipr-oil, ipr-gas, sens, cmp-a, cmp-b, pvt) y dentro hay un map
 * { nombre → payload }.
 */

const ROOT = "violet-scenarios";

interface AllScenarios {
  [key: string]: { [name: string]: unknown };
}

function readAll(): AllScenarios {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ROOT);
    return raw ? (JSON.parse(raw) as AllScenarios) : {};
  } catch {
    return {};
  }
}

function writeAll(data: AllScenarios): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ROOT, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function listScenarios(key: string): string[] {
  const all = readAll();
  return Object.keys(all[key] ?? {}).sort();
}

export function saveScenario<T>(key: string, name: string, value: T): void {
  if (!name.trim()) return;
  const all = readAll();
  all[key] = all[key] ?? {};
  all[key][name] = value;
  writeAll(all);
}

export function loadScenario<T>(key: string, name: string): T | null {
  const all = readAll();
  const entry = all[key]?.[name];
  return entry === undefined ? null : (entry as T);
}

export function deleteScenario(key: string, name: string): void {
  const all = readAll();
  if (all[key] && all[key][name] !== undefined) {
    delete all[key][name];
    writeAll(all);
  }
}
