// Shared by scripts/build-data.ts (the 3 originally-vendored speakers) and
// scripts/sync-measurements.ts (everything pulled from the wider spinorama
// catalog): turns one speaker's "asr" measurement directory (SPL
// Horizontal.txt, SPL Vertical.txt, optionally CEA2034.txt, LICENSE.txt)
// into the SpeakerData/SpeakerIndexEntry JSON this app reads at runtime.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { parseKlippelTxt } from '../../src/core/klippel.ts';
import { buildLogGrid } from '../../src/core/grid.ts';
import { resampleToGrid } from '../../src/core/resample.ts';
import { computeCea2034, type Plane } from '../../src/core/cea2034.ts';
import { listeningWindowOffsetDb } from '../../src/core/normalize.ts';
import { computePrefScoreMetrics } from '../../src/core/prefScore.ts';
import type { SpeakerData, SpeakerIndexEntry, PlaneJson } from '../../src/core/types.ts';

export const GRID = buildLogGrid();

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function roundCurve(xs: number[]): number[] {
  return xs.map(round2);
}

interface NativePlane {
  freqHz: number[];
  plane: Plane;
}

// H, V (and, when present, the reference CEA2034.txt) all share one native,
// non-uniform frequency grid per speaker. Parse at native resolution so the
// CEA2034 math runs before any resampling, not after.
function loadNativePlane(path: string): NativePlane {
  const text = readFileSync(path, 'utf-8');
  const file = parseKlippelTxt(text);
  const plane: Plane = {};
  for (const trace of file.traces) {
    plane[trace.name] = trace.valueDb;
  }
  return { freqHz: file.traces[0]?.freqHz ?? [], plane };
}

function resamplePlane(freqHz: number[], plane: Plane): Plane {
  const out: Plane = {};
  for (const [label, curve] of Object.entries(plane)) {
    out[label] = resampleToGrid(freqHz, curve, GRID);
  }
  return out;
}

function shiftPlane(plane: Plane, offsetDb: number): PlaneJson {
  const out: PlaneJson = {};
  for (const [label, curve] of Object.entries(plane)) {
    out[label] = roundCurve(curve.map((v) => v - offsetDb));
  }
  return out;
}

export interface SpeakerSource {
  /** Directory containing SPL Horizontal.txt / SPL Vertical.txt, and
   * usually LICENSE.txt (not every source ships one - see licenseFallback). */
  asrDir: string;
  id: string;
  name: string;
  brand: string;
  model: string;
  origin: string;
  /** Used verbatim as the license text when asrDir has no LICENSE.txt (e.g.
   * Erin's Audio Corner measurements, which spinorama doesn't ship a
   * license file for) - a link to the original review, not an asserted
   * license we haven't independently verified. */
  licenseFallback?: string;
}

/** Throws if the required SPL Horizontal.txt/SPL Vertical.txt files are
 * missing - callers that are scanning many candidate directories (the sync
 * script) should check hasRequiredFiles() first instead of catching. */
export function hasRequiredFiles(asrDir: string): boolean {
  return existsSync(join(asrDir, 'SPL Horizontal.txt')) && existsSync(join(asrDir, 'SPL Vertical.txt'));
}

export function buildSpeaker(spec: SpeakerSource): SpeakerData {
  const hPath = join(spec.asrDir, 'SPL Horizontal.txt');
  const vPath = join(spec.asrDir, 'SPL Vertical.txt');
  const licensePath = join(spec.asrDir, 'LICENSE.txt');

  const { freqHz: hFreq, plane: hNative } = loadNativePlane(hPath);
  const { freqHz: vFreq, plane: vNative } = loadNativePlane(vPath);

  // CEA2034 math runs on the native grid, then the six output curves are
  // resampled to the common grid, same as the raw H/V traces.
  const spinNative = computeCea2034(hFreq, hNative, vNative);
  const spin = {
    onAxis: resampleToGrid(hFreq, spinNative.onAxis, GRID),
    listeningWindow: resampleToGrid(hFreq, spinNative.listeningWindow, GRID),
    earlyReflections: resampleToGrid(hFreq, spinNative.earlyReflections, GRID),
    soundPower: resampleToGrid(hFreq, spinNative.soundPower, GRID),
    soundPowerDi: resampleToGrid(hFreq, spinNative.soundPowerDi, GRID),
    earlyReflectionsDi: resampleToGrid(hFreq, spinNative.earlyReflectionsDi, GRID),
    estimatedInRoom: resampleToGrid(hFreq, spinNative.estimatedInRoom, GRID),
  };
  const offsetDb = listeningWindowOffsetDb(GRID, spin.listeningWindow);

  const h = resamplePlane(hFreq, hNative);
  const v = resamplePlane(vFreq, vNative);

  const license = existsSync(licensePath) ? readFileSync(licensePath, 'utf-8').trim() : (spec.licenseFallback ?? '');

  const normalizedOnAxis = spin.onAxis.map((v2) => v2 - offsetDb);

  return {
    id: spec.id,
    name: spec.name,
    brand: spec.brand,
    model: spec.model,
    origin: spec.origin,
    license,
    freqHz: roundCurve(GRID),
    cea2034: {
      freqHz: roundCurve(GRID),
      onAxis: roundCurve(normalizedOnAxis),
      listeningWindow: roundCurve(spin.listeningWindow.map((v2) => v2 - offsetDb)),
      earlyReflections: roundCurve(spin.earlyReflections.map((v2) => v2 - offsetDb)),
      soundPower: roundCurve(spin.soundPower.map((v2) => v2 - offsetDb)),
      soundPowerDi: roundCurve(spin.soundPowerDi),
      earlyReflectionsDi: roundCurve(spin.earlyReflectionsDi),
      estimatedInRoom: roundCurve(spin.estimatedInRoom.map((v2) => v2 - offsetDb)),
    },
    horizontal: shiftPlane(h, offsetDb),
    vertical: shiftPlane(v, offsetDb),
  };
}

export function indexEntryFor(data: SpeakerData): SpeakerIndexEntry {
  return {
    id: data.id,
    name: data.name,
    brand: data.brand,
    model: data.model,
    origin: data.origin,
    metrics: data.cea2034 ? computePrefScoreMetrics(data.cea2034) : null,
    views: {
      cea2034: !!data.cea2034,
      inRoom: !!data.cea2034?.estimatedInRoom,
      sweetSpot: !!(data.horizontal && data.vertical),
      offAxis: !!(data.horizontal && data.vertical),
    },
  };
}
