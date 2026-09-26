// CTA-2034-A spinorama computation: On-Axis, Listening Window, Early
// Reflections, Sound Power, their directivity indices, and the Estimated
// In-Room Response. All averaging happens in the energy (pressure) domain,
// never in dB.
//
// Reference implementation: spinorama's src/spinorama/compute/cea2034.py at
// the pinned commit. Curves here are plain arrays aligned to a shared
// frequency grid (the caller resamples H/V onto that grid first), which
// replaces the reference's pandas merge-on-Freq with a simple index-wise
// operation.

import { SP_WEIGHTS } from './weights.ts';

/** One measurement plane: angle label ("On Axis", "10°", "-10°", ...) to a
 * dB curve aligned to the shared frequency grid. */
export type Plane = Record<string, number[]>;

function splToPressure(spl: number): number {
  return Math.pow(10, (spl - 105.0) / 20.0);
}

function pressureToSpl(pressure: number): number {
  return 105.0 + 20.0 * Math.log10(pressure);
}

function energyAverage(curves: number[][], weights?: number[]): number[] {
  const n = curves[0]?.length ?? 0;
  const out = new Array<number>(n);
  const w = weights ?? curves.map(() => 1);
  const wSum = w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let c = 0; c < curves.length; c++) {
      const p = splToPressure(curves[c][i]);
      acc += w[c] * p * p;
    }
    out[i] = pressureToSpl(Math.sqrt(acc / wSum));
  }
  return out;
}

function pick(plane: Plane, labels: string[]): number[][] {
  return labels.filter((l) => l in plane).map((l) => plane[l]);
}

function subtractDb(a: number[], b: number[]): number[] {
  return a.map((v, i) => v - b[i]);
}

const FRONT_H = ['On Axis', '10°', '20°', '30°', '-10°', '-20°', '-30°'];
const SIDE_H = ['40°', '50°', '60°', '70°', '80°', '-40°', '-50°', '-60°', '-70°', '-80°'];
// spinorama's cea2034.py offers a "corrected" 18-angle rear wall bounce and an
// older 3-angle one; the published CEA2034.txt/Early Reflections.txt files
// were generated with the older method (verified against KEF R3's published
// Early Reflections.txt), so match that to reproduce them.
const REAR_H = ['-90°', '90°', '180°'];
const FLOOR_V = ['-20°', '-30°', '-40°'];
const CEILING_V = ['40°', '50°', '60°'];

export function onAxis(h: Plane, v: Plane): number[] {
  return energyAverage(pick(h, ['On Axis']).concat(pick(v, ['On Axis'])));
}

export function listeningWindow(h: Plane, v: Plane): number[] {
  const cols = pick(h, ['10°', '20°', '30°', '-10°', '-20°', '-30°']).concat(
    pick(v, ['On Axis', '10°', '-10°']),
  );
  return energyAverage(cols);
}

export function soundPower(h: Plane, v: Plane): number[] {
  const hLabels = Object.keys(h);
  const vLabels = Object.keys(v).filter((l) => l !== 'On Axis' && l !== '180°');
  const cols = pick(h, hLabels).concat(pick(v, vLabels));
  const weights = hLabels
    .filter((l) => l in h)
    .map((l) => SP_WEIGHTS[l])
    .concat(vLabels.filter((l) => l in v).map((l) => SP_WEIGHTS[l]));
  return energyAverage(cols, weights);
}

export interface EarlyReflectionParts {
  floor: number[];
  ceiling: number[];
  front: number[];
  side: number[];
  rear: number[];
  total: number[];
}

export function earlyReflections(h: Plane, v: Plane): EarlyReflectionParts {
  const floor = energyAverage(pick(v, FLOOR_V));
  const ceiling = energyAverage(pick(v, CEILING_V));
  const front = energyAverage(pick(h, FRONT_H));
  const side = energyAverage(pick(h, SIDE_H));
  const rear = energyAverage(pick(h, REAR_H));
  // The published total is a weighted energy average of the five zones,
  // weighted by how many raw angle traces feed each zone (not one-zone-one-
  // vote) - verified against the published Early Reflections.txt files.
  const total = energyAverage(
    [floor, ceiling, front, side, rear],
    [FLOOR_V.length, CEILING_V.length, FRONT_H.length, SIDE_H.length, REAR_H.length],
  );
  return { floor, ceiling, front, side, rear, total };
}

export interface Cea2034 {
  freqHz: number[];
  onAxis: number[];
  listeningWindow: number[];
  earlyReflections: number[];
  soundPower: number[];
  soundPowerDi: number[];
  earlyReflectionsDi: number[];
  estimatedInRoom: number[];
}

export function computeCea2034(freqHz: number[], h: Plane, v: Plane): Cea2034 {
  const on = onAxis(h, v);
  const lw = listeningWindow(h, v);
  const sp = soundPower(h, v);
  const er = earlyReflections(h, v).total;
  const soundPowerDi = subtractDb(lw, sp);
  const earlyReflectionsDi = subtractDb(lw, er);
  const estimatedInRoom = lw.map((lwDb, i) => {
    const p = 0.12 * splToPressure(lwDb) ** 2 + 0.44 * splToPressure(er[i]) ** 2 + 0.44 * splToPressure(sp[i]) ** 2;
    return pressureToSpl(Math.sqrt(p));
  });
  return {
    freqHz,
    onAxis: on,
    listeningWindow: lw,
    earlyReflections: er,
    soundPower: sp,
    soundPowerDi,
    earlyReflectionsDi,
    estimatedInRoom,
  };
}
