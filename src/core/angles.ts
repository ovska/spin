// Angle-plane interpolation shared by the Sweet spot and Off-axis views:
// turning a measured Plane (angle label -> dB curve) into values at
// arbitrary query angles, and combining two planes into an off-axis
// (h, v) estimate.

import { pchipPeriodic } from './pchip.ts';
import type { Plane } from './cea2034.ts';

/** "On Axis" -> 0, "10°" -> 10, "-10°" -> -10, "180°" -> 180. */
export function angleLabelToDeg(label: string): number {
  if (label === 'On Axis') return 0;
  const n = Number(label.replace('°', ''));
  if (!Number.isFinite(n)) throw new Error(`not an angle label: ${label}`);
  return n;
}

/** Interpolates a plane at each frequency independently: for every
 * frequency index, periodic PCHIP across the plane's measured angles, then
 * evaluated at every query angle. Returns one full curve per query angle
 * (curves[queryIdx][freqIdx]), so setup cost (per-frequency PCHIP slopes) is
 * paid once per frequency rather than once per query angle. */
export function interpolatePlaneAngles(plane: Plane, freqLen: number, queryAnglesDeg: number[]): number[][] {
  const entries = Object.entries(plane)
    .map(([label, curve]) => ({ deg: angleLabelToDeg(label), curve }))
    .sort((a, b) => a.deg - b.deg);
  const angles = entries.map((e) => e.deg);

  const out: number[][] = queryAnglesDeg.map(() => new Array(freqLen));
  for (let f = 0; f < freqLen; f++) {
    const valuesAtFreq = entries.map((e) => e.curve[f]);
    const interpolated = pchipPeriodic(angles, valuesAtFreq, queryAnglesDeg);
    for (let q = 0; q < queryAnglesDeg.length; q++) out[q][f] = interpolated[q];
  }
  return out;
}

/** SPL(h, v) ~= SPL(h, 0) + SPL(0, v) - SPL(0, 0): the standard estimate for
 * an off-plane point from the horizontal and vertical measurement planes
 * alone (which only cover h at v=0 and v at h=0). Reduces exactly to
 * SPL(h,0) when v=0 and to SPL(0,v) when h=0, so no special-casing is
 * needed at the plane boundaries. */
export function estimateOffPlane(hCurve: number[], vCurve: number[], onAxisCurve: number[]): number[] {
  return hCurve.map((h, i) => h + vCurve[i] - onAxisCurve[i]);
}

/** Linear-interpolated percentile (0-1) of an already-sorted ascending
 * array. Min/max/percentile are order statistics, so computing them
 * directly on dB values (rather than in the energy domain) picks out
 * exactly the same underlying sample - dB is a monotonic transform of
 * pressure, so it can't change the rank order. */
export function percentile(sortedAscending: number[], p: number): number {
  const idx = (sortedAscending.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAscending[lo];
  const t = idx - lo;
  return sortedAscending[lo] * (1 - t) + sortedAscending[hi] * t;
}
