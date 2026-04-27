import { useEffect, useState } from "react";
import { Bookmark, Save, Trash2, Upload } from "lucide-react";
import {
  deleteScenario,
  listScenarios,
  loadScenario,
  saveScenario,
} from "@/lib/scenarios";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface Props<T> {
  storageKey: string;
  current: T;
  onLoad: (value: T) => void;
}

export function ScenarioManager<T>({ storageKey, current, onLoad }: Props<T>) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [items, setItems] = useState<string[]>([]);

  const refresh = () => setItems(listScenarios(storageKey));
  useEffect(refresh, [storageKey]);

  const onSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    saveScenario(storageKey, trimmed, current);
    setName("");
    refresh();
    setSelected(trimmed);
  };

  const onLoadClick = () => {
    if (!selected) return;
    const v = loadScenario<T>(storageKey, selected);
    if (v !== null) onLoad(v);
  };

  const onDelete = () => {
    if (!selected) return;
    deleteScenario(storageKey, selected);
    setSelected("");
    refresh();
  };

  return (
    <div className="rounded-md border border-border/40 bg-muted/30 p-3">
      <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
        <Bookmark className="h-3.5 w-3.5" />
        Escenarios guardados
      </p>
      <div className="flex gap-2">
        <Input
          placeholder="Nombre del escenario"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 text-xs"
          aria-label="Nombre del escenario"
        />
        <Button size="sm" variant="secondary" onClick={onSave} disabled={!name.trim()}>
          <Save className="h-3.5 w-3.5" />
        </Button>
      </div>
      {items.length > 0 && (
        <div className="mt-2 flex gap-2">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Cargar…" />
            </SelectTrigger>
            <SelectContent>
              {items.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={onLoadClick} disabled={!selected} aria-label="Cargar">
            <Upload className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            disabled={!selected}
            aria-label="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      )}
    </div>
  );
}
