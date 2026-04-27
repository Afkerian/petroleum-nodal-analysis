/**
 * Sistema de toasts minimalista — sin dependencias externas. API similar a
 * sonner / react-hot-toast pero ~50 líneas. Pub/sub interno; el componente
 * <ToastViewport/> se suscribe y renderiza.
 */
import { useEffect, useState } from "react";

export type ToastKind = "info" | "success" | "warning" | "error";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
  durationMs: number;
}

let nextId = 1;
const subscribers = new Set<(t: ToastItem[]) => void>();
let queue: ToastItem[] = [];

function notify() {
  for (const cb of subscribers) cb([...queue]);
}

function push(t: Omit<ToastItem, "id">): number {
  const id = nextId++;
  queue = [...queue, { ...t, id }];
  notify();
  if (t.durationMs > 0) {
    setTimeout(() => dismiss(id), t.durationMs);
  }
  return id;
}

export function dismiss(id: number) {
  queue = queue.filter((q) => q.id !== id);
  notify();
}

export const toast = {
  info: (title: string, description?: string, durationMs = 3500) =>
    push({ kind: "info", title, description, durationMs }),
  success: (title: string, description?: string, durationMs = 3500) =>
    push({ kind: "success", title, description, durationMs }),
  warning: (title: string, description?: string, durationMs = 5000) =>
    push({ kind: "warning", title, description, durationMs }),
  error: (title: string, description?: string, durationMs = 6000) =>
    push({ kind: "error", title, description, durationMs }),
};

export function useToasts(): ToastItem[] {
  const [items, setItems] = useState<ToastItem[]>(queue);
  useEffect(() => {
    subscribers.add(setItems);
    return () => {
      subscribers.delete(setItems);
    };
  }, []);
  return items;
}
