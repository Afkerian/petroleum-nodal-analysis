/// <reference lib="webworker" />
/**
 * Web Worker para barridos VLP intensivos. Recibe un array de VLPInput,
 * ejecuta calculatePwf31 sobre cada uno y devuelve los resultados.
 *
 * Uso desde el main thread:
 *   const w = new Worker(new URL("./vlp.worker.ts", import.meta.url), { type: "module" });
 *   w.postMessage({ inputs: [...] });
 *   w.onmessage = (e) => setResults(e.data);
 */
import { calculatePwf31, type VLPInput } from "@/lib/vlp-models";

interface WorkerRequest {
  id?: string;
  inputs: VLPInput[];
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, inputs } = e.data;
  const out = inputs.map((inp) => calculatePwf31(inp));
  (self as unknown as Worker).postMessage({ id, results: out });
};
