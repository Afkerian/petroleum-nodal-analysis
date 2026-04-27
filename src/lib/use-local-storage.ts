import { useEffect, useState } from "react";

/**
 * Hook que persiste estado en localStorage. Lee al montar, escribe en cada
 * cambio. Si el JSON está corrupto, cae al valor por defecto sin romper.
 */
export function useLocalStorage<T>(
  key: string,
  initial: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return initial;
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore quota / private mode errors */
    }
  }, [key, value]);

  return [value, setValue];
}
