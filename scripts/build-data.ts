// Build step: reads vendored Klippel .txt exports from data/raw and writes
// one public/data/<id>.json per speaker plus public/data/index.json.
//
// Run with `npm run data`.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { parseKlippelTxt } from '../src/core/klippel.ts';
import { buildLogGrid } from '../src/core/grid.ts';
import { resampleToGrid } from '../src/core/resample.ts';
import { computeCea2034, type Plane } from '../src/core/cea2034.ts';
import { listeningWindowOffsetDb } from '../src/core/normalize.ts';
import { computeMinPhase } from '../src/core/minphase.ts';
import type { SpeakerData, DataIndex, SpeakerIndexEntry, PlaneJson } from '../src/core/types.ts';

const ROOT = join(import.meta.dirname, '..');
const RAW_DIR = join(ROOT, 'data', 'raw');
const OUT_DIR = join(ROOT, 'public', 'data');

interface SpeakerSpec {
  dir: string;
  id: string;
  name: string;
}

const SPEAKERS: SpeakerSpec[] = [
  { dir: 'KEF R3', id: 'kef-r3', name: 'KEF R3' },
  { dir: 'Genelec 8030C', id: 'genelec-8030c', name: 'Genelec 8030C' },
  { dir: 'Neumann KH 120 II', id: 'neumann-kh-120-ii', name: 'Neumann KH 120 II' },
];

const GRID = buildLogGrid();

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function roundCurve(xs: number[]): number[] {
  return xs.map(round2);
}

function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6;
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

function buildSpeaker(spec: SpeakerSpec): SpeakerData {
  const asrDir = join(RAW_DIR, spec.dir, 'asr');
  const hPath = join(asrDir, 'SPL Horizontal.txt');
  const vPath = join(asrDir, 'SPL Vertical.txt');
  const licensePath = join(asrDir, 'LICENSE.txt');

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

  const license = existsSync(licensePath) ? readFileSync(licensePath, 'utf-8').trim() : '';

  const normalizedOnAxis = spin.onAxis.map((v2) => v2 - offsetDb);
  const minPhase = computeMinPhase(GRID, normalizedOnAxis);

  const data: SpeakerData = {
    id: spec.id,
    name: spec.name,
    origin: 'Audio Science Review',
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
    stepImpulse: {
      timeMs: minPhase.timeMs.map((t) => Math.round(t * 1000) / 1000),
      impulse: minPhase.impulse.map(round6),
      step: minPhase.step.map(round6),
    },
  };

  return data;
}

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });

  const index: DataIndex = { speakers: [] };

  for (const spec of SPEAKERS) {
    console.log(`Building ${spec.name}...`);
    const data = buildSpeaker(spec);
    writeFileSync(join(OUT_DIR, `${spec.id}.json`), JSON.stringify(data));

    const entry: SpeakerIndexEntry = {
      id: spec.id,
      name: spec.name,
      origin: data.origin,
      views: {
        cea2034: !!data.cea2034,
        inRoom: !!data.cea2034?.estimatedInRoom,
        sweetSpot: !!(data.horizontal && data.vertical),
        offAxis: !!(data.horizontal && data.vertical),
        step: !!data.stepImpulse,
      },
    };
    index.speakers.push(entry);
  }

  writeFileSync(join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2));
  console.log(`Wrote ${index.speakers.length} speakers to ${OUT_DIR}`);
}

main();
