// Turns listening-position geometry (or a manually-entered angle range)
// into an angle window, samples it on a 2.5 degree grid, and summarizes the
// resulting spread of curves (average, min-max, 25th-75th percentile).

import { energyAverage } from './energy.ts';
import { interpolatePlaneAngles, estimateOffPlane, percentile } from './angles.ts';
import type { Plane } from './cea2034.ts';

export interface ListenerGeometry {
  distanceCm: number;
  tweeterHeightCm: number;
  earHeightCm: number;
  headMoveHCm: number;
  headMoveVCm: number;
  toeInDeg: number;
}

export interface AngleWindow {
  hMin: number;
  hMax: number;
  vMin: number;
  vMax: number;
}

function radToDeg(r: number): number {
  return (r * 180) / Math.PI;
}

/** Simplified geometry model (documented, not acoustically exact): toe-in is
 * taken directly as the horizontal angle at the center of the head-movement
 * box (i.e. as "how far off-axis the sweet spot center already is"), and
 * head movement widens the window by the angle subtended by that much
 * lateral/vertical movement at the given listening distance. Reproducing a
 * speaker's exact toe-in pivot geometry would need its lateral offset from
 * the listening position too, which isn't one of the configured inputs. */
export function geometryToWindow(g: ListenerGeometry): AngleWindow {
  const vCenter = radToDeg(Math.atan2(g.earHeightCm - g.tweeterHeightCm, g.distanceCm));
  const hHalfWidth = radToDeg(Math.atan2(g.headMoveHCm, g.distanceCm));
  const vHalfWidth = radToDeg(Math.atan2(g.headMoveVCm, g.distanceCm));
  return {
    hMin: g.toeInDeg - hHalfWidth,
    hMax: g.toeInDeg + hHalfWidth,
    vMin: vCenter - vHalfWidth,
    vMax: vCenter + vHalfWidth,
  };
}

function rangeStep(min: number, max: number, step: number): number[] {
  if (max <= min) return [min];
  const out: number[] = [];
  for (let x = min; x < max - 1e-9; x += step) out.push(x);
  out.push(max);
  return out;
}

export interface SweetSpotSample {
  hDeg: number;
  vDeg: number;
  curve: number[];
}

export interface SweetSpotResult {
  average: number[];
  min: number[];
  max: number[];
  p25: number[];
  p75: number[];
  samples: SweetSpotSample[];
}

const GRID_STEP_DEG = 2.5;

export function computeSweetSpot(
  h: Plane,
  v: Plane,
  onAxis: number[],
  freqLen: number,
  window: AngleWindow,
  stepDeg = GRID_STEP_DEG,
): SweetSpotResult {
  const hAngles = rangeStep(window.hMin, window.hMax, stepDeg);
  const vAngles = rangeStep(window.vMin, window.vMax, stepDeg);
  const hCurves = interpolatePlaneAngles(h, freqLen, hAngles);
  const vCurves = interpolatePlaneAngles(v, freqLen, vAngles);

  const samples: SweetSpotSample[] = [];
  for (let hi = 0; hi < hAngles.length; hi++) {
    for (let vi = 0; vi < vAngles.length; vi++) {
      samples.push({
        hDeg: hAngles[hi],
        vDeg: vAngles[vi],
        curve: estimateOffPlane(hCurves[hi], vCurves[vi], onAxis),
      });
    }
  }

  const average = energyAverage(samples.map((s) => s.curve));
  const min = new Array<number>(freqLen);
  const max = new Array<number>(freqLen);
  const p25 = new Array<number>(freqLen);
  const p75 = new Array<number>(freqLen);
  for (let f = 0; f < freqLen; f++) {
    const col = samples.map((s) => s.curve[f]).sort((a, b) => a - b);
    min[f] = col[0];
    max[f] = col[col.length - 1];
    p25[f] = percentile(col, 0.25);
    p75[f] = percentile(col, 0.75);
  }

  return { average, min, max, p25, p75, samples };
}
