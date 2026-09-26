// Resamples a measured (freq, dB) curve onto an arbitrary target frequency
// grid, via linear interpolation in (log10 freq, dB) space. Outside the
// measured range the curve is held flat at the nearest endpoint.

export function resampleToGrid(freqHz: number[], valueDb: number[], grid: number[]): number[] {
  const n = freqHz.length;
  if (n === 0) return grid.map(() => NaN);
  if (n === 1) return grid.map(() => valueDb[0]);

  // Defensive: Klippel exports are ascending, but don't assume.
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => freqHz[a] - freqHz[b]);
  const logF = order.map((i) => Math.log10(freqHz[i]));
  const v = order.map((i) => valueDb[i]);

  const out: number[] = new Array(grid.length);
  let j = 0;
  for (let g = 0; g < grid.length; g++) {
    const lf = Math.log10(grid[g]);
    if (lf <= logF[0]) {
      out[g] = v[0];
      continue;
    }
    if (lf >= logF[n - 1]) {
      out[g] = v[n - 1];
      continue;
    }
    while (j < n - 2 && logF[j + 1] < lf) j++;
    const t = (lf - logF[j]) / (logF[j + 1] - logF[j]);
    out[g] = v[j] + t * (v[j + 1] - v[j]);
  }
  return out;
}
