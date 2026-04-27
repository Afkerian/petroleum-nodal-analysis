import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: { value: number; positiveIsGood?: boolean };
  icon?: ReactNode;
  hint?: string;
  className?: string;
  tone?: "default" | "success" | "warning" | "danger";
}

const TONE_CLS: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  default: "border-border/50 bg-card",
  success: "border-emerald-500/30 bg-emerald-500/5",
  warning: "border-yellow-500/30 bg-yellow-500/5",
  danger: "border-destructive/40 bg-destructive/5",
};

export function KpiCard({
  label,
  value,
  unit,
  delta,
  icon,
  hint,
  className,
  tone = "default",
}: KpiCardProps) {
  const deltaSign = delta && delta.value >= 0 ? "+" : "";
  const deltaGood =
    delta &&
    ((delta.positiveIsGood ?? true) ? delta.value >= 0 : delta.value <= 0);
  return (
    <div className={cn("rounded-lg border p-3 anim-fade-in", TONE_CLS[tone], className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-mono text-xl font-bold leading-none text-foreground tabular-nums">
          {value}
        </span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      {(delta || hint) && (
        <div className="mt-1 flex items-center gap-2 text-[10px]">
          {delta && (
            <span
              className={cn(
                "rounded-sm px-1 py-0.5 font-mono",
                deltaGood ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-destructive/15 text-destructive"
              )}
            >
              {deltaSign}
              {delta.value.toFixed(1)}%
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      )}
    </div>
  );
}
