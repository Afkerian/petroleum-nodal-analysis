import { useEffect, useMemo, useRef, useState } from "react";
import { Command, Keyboard, Search } from "lucide-react";

export interface CommandAction {
  id: string;
  label: string;
  hint?: string;
  group?: string;
  shortcut?: string;
  run: () => void;
}

interface Props {
  actions: CommandAction[];
}

export function CommandPalette({ actions }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isOpen = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k";
      if (isOpen) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.hint?.toLowerCase().includes(q) ||
        a.group?.toLowerCase().includes(q)
    );
  }, [query, actions]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-foreground/30 p-4 pt-24 backdrop-blur-sm anim-fade-in no-print"
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Paleta de comandos"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => Math.min(filtered.length - 1, h + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => Math.max(0, h - 1));
              } else if (e.key === "Enter") {
                const a = filtered[highlight];
                if (a) {
                  a.run();
                  setOpen(false);
                }
              }
            }}
            placeholder="Escribe un comando o búsqueda…"
            className="flex-1 bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline-block">
            ESC
          </kbd>
        </div>
        <ul className="max-h-[340px] overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">
              Sin resultados.
            </li>
          ) : (
            filtered.map((a, i) => (
              <li key={a.id}>
                <button
                  className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm ${
                    i === highlight ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => {
                    a.run();
                    setOpen(false);
                  }}
                >
                  <span className="flex flex-col">
                    <span className="font-medium">{a.label}</span>
                    {a.hint && <span className="text-[10px] opacity-70">{a.hint}</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    {a.group && (
                      <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide opacity-80">
                        {a.group}
                      </span>
                    )}
                    {a.shortcut && (
                      <kbd className="rounded border border-current/30 px-1.5 py-0.5 text-[10px] font-mono opacity-80">
                        {a.shortcut}
                      </kbd>
                    )}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/40 px-3 py-1.5 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Command className="h-3 w-3" />
            <span>K para abrir</span>
          </span>
          <span className="flex items-center gap-1">
            <Keyboard className="h-3 w-3" />
            <span>↑↓ navegar · ↵ ejecutar · ESC cerrar</span>
          </span>
        </div>
      </div>
    </div>
  );
}
