// Precomputed 1-degree-resolution interpolated rows for the Off-axis view,
// shared by the heatmap and the scrubbed-curve chart so scrubbing the angle
// is a plain array index (no PCHIP at drag time) - the spec's "precompute
// the 1 degree interpolated rows once per speaker and smoothing setting" for
// steady 60fps.

import { interpolatePlaneAngles } from '../core/angles';
import { smoothPowerDomain, type SmoothingMode } from '../core/smoothing';
import type { SpeakerData } from '../core/types';

export const H_ANGLE_MIN = -40;
export const H_ANGLE_MAX = 40;
export const V_ANGLE_MIN = -30;
export const V_ANGLE_MAX = 40;

function integerRange(min: number, max: number): number[] {
  const out: number[] = [];
  for (let a = min; a <= max; a++) out.push(a);
  return out;
}

const H_ANGLES = integerRange(H_ANGLE_MIN, H_ANGLE_MAX);
const V_ANGLES = integerRange(V_ANGLE_MIN, V_ANGLE_MAX);

export interface OffAxisTable {
  freqHz: number[];
  onAxis: number[];
  horizontal: { angles: number[]; curves: number[][] };
  vertical: { angles: number[]; curves: number[][] };
}

interface CacheEntry {
  mode: SmoothingMode;
  table: OffAxisTable;
}

const cache = new Map<string, CacheEntry>();

export function getOffAxisTable(data: SpeakerData, mode: SmoothingMode): OffAxisTable {
  const cached = cache.get(data.id);
  if (cached && cached.mode === mode) return cached.table;

  const freqHz = data.cea2034?.freqHz ?? [];
  const onAxis = smoothPowerDomain(freqHz, data.cea2034?.onAxis ?? [], mode);

  const hSmoothed: Record<string, number[]> = {};
  for (const [label, curve] of Object.entries(data.horizontal ?? {})) {
    hSmoothed[label] = smoothPowerDomain(freqHz, curve, mode);
  }
  const vSmoothed: Record<string, number[]> = {};
  for (const [label, curve] of Object.entries(data.vertical ?? {})) {
    vSmoothed[label] = smoothPowerDomain(freqHz, curve, mode);
  }

  const table: OffAxisTable = {
    freqHz,
    onAxis,
    horizontal: { angles: H_ANGLES, curves: interpolatePlaneAngles(hSmoothed, freqHz.length, H_ANGLES) },
    vertical: { angles: V_ANGLES, curves: interpolatePlaneAngles(vSmoothed, freqHz.length, V_ANGLES) },
  };
  cache.set(data.id, { mode, table });
  return table;
}

export function clearOffAxisCache(id: string): void {
  cache.delete(id);
}

/** Nearest-degree row lookup (the slider/tap only ever pick whole degrees,
 * so this is always an exact index, not an interpolation). */
export function rowForAngle(table: OffAxisTable['horizontal'], deg: number): number[] {
  const idx = Math.round(deg) - table.angles[0];
  const clamped = Math.max(0, Math.min(table.curves.length - 1, idx));
  return table.curves[clamped];
}
