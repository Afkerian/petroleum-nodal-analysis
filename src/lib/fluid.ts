/**
 * Estado global del fluido (oil/gas). Persistido en localStorage para que
 * todos los tabs (IPR, VLP, Sensibilidad, Comparación, PVT) compartan la
 * misma elección y el usuario no la repita.
 */
import { createContext, useContext, useEffect, useState, type ReactNode, createElement } from "react";

export type Fluid = "oil" | "gas";

interface Ctx {
  fluid: Fluid;
  setFluid: (f: Fluid) => void;
}

const STORAGE_KEY = "violet-fluid";

const FluidCtx = createContext<Ctx>({ fluid: "oil", setFluid: () => {} });

export function FluidProvider({ children }: { children: ReactNode }) {
  const [fluid, setFluidState] = useState<Fluid>(() => {
    if (typeof window === "undefined") return "oil";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "gas" || stored === "oil" ? stored : "oil";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, fluid);
    }
  }, [fluid]);

  return createElement(FluidCtx.Provider, { value: { fluid, setFluid: setFluidState } }, children);
}

export function useFluid() {
  return useContext(FluidCtx);
}
