/**
 * Exporta filas a CSV. Las filas son arrays de strings/numbers; la primera
 * fila contiene los headers. Usa BOM UTF-8 para que Excel interprete bien
 * las tildes españolas.
 */
export function downloadCSV(
  rows: Array<Array<string | number>>,
  filename: string
): void {
  if (rows.length === 0) return;
  const escape = (cell: string | number): string => {
    const s = String(cell ?? "");
    if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
