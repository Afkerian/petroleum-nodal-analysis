import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { dismiss, useToasts, type ToastKind } from "@/lib/toast";

const ICONS: Record<ToastKind, JSX.Element> = {
  info: <Info className="h-4 w-4" />,
  success: <CheckCircle2 className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  error: <XCircle className="h-4 w-4" />,
};

const TONE: Record<ToastKind, string> = {
  info: "border-primary/30 bg-primary/5 text-primary",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  warning: "border-yellow-500/30 bg-yellow-500/10 text-yellow-800 dark:text-yellow-200",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
};

export function ToastViewport() {
  const items = useToasts();
  if (items.length === 0) return null;
  return (
    <div
      role="region"
      aria-label="Notificaciones"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[320px] flex-col gap-2 no-print"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto flex items-start gap-2 rounded-md border bg-card p-3 text-sm shadow-lg anim-slide-up ${TONE[t.kind]}`}
        >
          <span className="mt-0.5 shrink-0">{ICONS[t.kind]}</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t.title}</p>
            {t.description && (
              <p className="mt-0.5 text-xs opacity-90">{t.description}</p>
            )}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="shrink-0 rounded-sm p-0.5 hover:bg-foreground/10"
            aria-label="Cerrar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
