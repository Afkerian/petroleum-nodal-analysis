import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tooltip ligero hover/focus, no requiere @radix-ui/react-tooltip. Útil para
 * glosario de términos técnicos junto a cada label (Pwf, AOF, Skin, Pb, etc.)
 */
interface Props {
  content: ReactNode;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
}

export function InfoTip({ content, className, side = "top" }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        tabIndex={0}
        className="grid h-3.5 w-3.5 place-items-center rounded-full text-muted-foreground hover:text-primary focus:outline-none focus:text-primary"
        aria-label="Más información"
      >
        <Info className="h-3 w-3" />
      </button>
      {open && (
        <span
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-50 w-56 rounded-md border border-border bg-popover px-2.5 py-1.5 text-[11px] leading-snug text-popover-foreground shadow-md anim-fade-in",
            side === "top" && "bottom-full left-1/2 mb-1 -translate-x-1/2",
            side === "bottom" && "left-1/2 top-full mt-1 -translate-x-1/2",
            side === "left" && "right-full top-1/2 mr-1 -translate-y-1/2",
            side === "right" && "left-full top-1/2 ml-1 -translate-y-1/2"
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
