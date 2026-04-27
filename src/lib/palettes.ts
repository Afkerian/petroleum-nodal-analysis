/**
 * Paletas perceptualmente uniformes para visualización de datos. Reemplazan
 * la rotación arbitraria de colores RGB cuando hay 5+ series superpuestas.
 *
 * `viridis`  : continuo, monocromático azul→amarillo, accesible (daltonismo)
 * `inferno`  : continuo, oscuro→cálido, alto contraste para presentaciones
 * `categorical`: 8 colores distinguibles (Wong 2011), seguros para daltonismo
 */

const viridisStops: Array<[number, number, number]> = [
  [68, 1, 84], [72, 36, 117], [64, 67, 135], [52, 94, 141],
  [41, 120, 142], [32, 144, 140], [34, 167, 132], [68, 190, 112],
  [121, 209, 81], [189, 222, 38], [253, 231, 37],
];

const infernoStops: Array<[number, number, number]> = [
  [0, 0, 4], [27, 12, 65], [66, 10, 104], [106, 23, 110],
  [147, 38, 103], [188, 55, 84], [221, 81, 58], [243, 120, 25],
  [252, 165, 10], [246, 215, 70], [252, 255, 164],
];

const categorical = [
  "#0072B2", "#D55E00", "#009E73", "#CC79A7",
  "#F0E442", "#56B4E9", "#E69F00", "#000000",
];

const interp = (stops: Array<[number, number, number]>, t: number): string => {
  const x = Math.min(0.999, Math.max(0, t)) * (stops.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = stops[i];
  const b = stops[i + 1] ?? stops[i];
  const r = Math.round(a[0] + (b[0] - a[0]) * f);
  const g = Math.round(a[1] + (b[1] - a[1]) * f);
  const bl = Math.round(a[2] + (b[2] - a[2]) * f);
  return `rgb(${r}, ${g}, ${bl})`;
};

export const palettes = {
  viridis: (n: number): string[] =>
    Array.from({ length: n }, (_, i) => interp(viridisStops, n === 1 ? 0.5 : i / (n - 1))),
  inferno: (n: number): string[] =>
    Array.from({ length: n }, (_, i) => interp(infernoStops, n === 1 ? 0.5 : i / (n - 1))),
  categorical: (n: number): string[] =>
    Array.from({ length: n }, (_, i) => categorical[i % categorical.length]),
};

export const colorScale = (t: number, kind: "viridis" | "inferno" = "viridis") =>
  interp(kind === "inferno" ? infernoStops : viridisStops, t);
