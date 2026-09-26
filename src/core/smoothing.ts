// Fractional-octave smoothing over frequency, in the power domain. Applied
// before angle interpolation (Sweet spot / Off-axis) and directly to any
// single curve view (CEA2034, In-room).
//
// The frequency grid (src/core/grid.ts) is uniform in log2(f), so a fixed
// octave-fraction window is a fixed number of grid points; ERB's window
// widens with frequency, so its point count is recomputed per index.

import { GRID_POINTS_PER_OCTAVE } from './grid';

export type SmoothingMode = 'none' | '1/12' | '1/6' | '1/3' | 'erb';

function octaveFractionHalfWidth(fraction: number): number {
  return Math.max(0, Math.round((GRID_POINTS_PER_OCTAVE * fraction) / 2));
}

function erbHz(freqHz: number): number {
  return 24.7 * (4.37 * (freqHz / 1000) + 1);
}

function erbHalfWidth(freqHz: number): number {
  const bw = erbHz(freqHz);
  const octaves = Math.log2((freqHz + bw / 2) / Math.max(1e-6, freqHz - bw / 2));
  return Math.max(0, Math.round((GRID_POINTS_PER_OCTAVE * octaves) / 2));
}

export function smoothPowerDomain(freqHz: number[], valueDb: number[], mode: SmoothingMode): number[] {
  if (mode === 'none') return valueDb.slice();
  const n = valueDb.length;
  const power = valueDb.map((v) => Math.pow(10, v / 10));
  const out = new Array<number>(n);

  const fixedHalfWidth =
    mode === '1/12' ? octaveFractionHalfWidth(1 / 12) : mode === '1/6' ? octaveFractionHalfWidth(1 / 6) : mode === '1/3' ? octaveFractionHalfWidth(1 / 3) : null;

  for (let i = 0; i < n; i++) {
    const halfWidth = fixedHalfWidth ?? erbHalfWidth(freqHz[i]);
    if (halfWidth === 0) {
      out[i] = valueDb[i];
      continue;
    }
    let sum = 0;
    let wSum = 0;
    const lo = Math.max(0, i - halfWidth);
    const hi = Math.min(n - 1, i + halfWidth);
    for (let k = lo; k <= hi; k++) {
      const w = 1 - Math.abs(k - i) / (halfWidth + 1);
      sum += w * power[k];
      wSum += w;
    }
    out[i] = 10 * Math.log10(sum / wSum);
  }
  return out;
}
