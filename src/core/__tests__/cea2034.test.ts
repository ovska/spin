import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseKlippelTxt } from '../klippel';
import { computeCea2034, type Plane } from '../cea2034';

const RAW_DIR = join(import.meta.dirname, '..', '..', '..', 'data', 'raw');

// H, V and the reference CEA2034.txt all share one native (non-uniform)
// frequency grid per speaker (verified against the raw files). Compute on
// that native grid directly, so the comparison isn't polluted by resampling
// error from two different interpolation paths.
function loadNativePlane(speaker: string, file: string): { freqHz: number[]; plane: Plane } {
  const text = readFileSync(join(RAW_DIR, speaker, 'asr', file), 'utf-8');
  const parsed = parseKlippelTxt(text);
  const plane: Plane = {};
  for (const trace of parsed.traces) {
    plane[trace.name] = trace.valueDb;
  }
  return { freqHz: parsed.traces[0].freqHz, plane };
}

// The reference file's "Sound Power DI" / "Early Reflections DI" traces have
// a constant "DI offset" baked in (so they plot on the same axis as SPL
// curves in the original charting tool) - confirmed by inspecting the raw
// "DI offset" trace, which is a flat ~40dB line. Subtract it before comparing.
function loadReference(speaker: string): Record<string, number[]> {
  const text = readFileSync(join(RAW_DIR, speaker, 'asr', 'CEA2034.txt'), 'utf-8');
  const parsed = parseKlippelTxt(text);
  const ref: Record<string, number[]> = {};
  for (const trace of parsed.traces) {
    ref[trace.name] = trace.valueDb;
  }
  const offset = ref['DI offset'];
  ref['Sound Power DI'] = ref['Sound Power DI'].map((v, i) => v - offset[i]);
  ref['Early Reflections DI'] = ref['Early Reflections DI'].map((v, i) => v - offset[i]);
  return ref;
}

function rmsDiff(freqHz: number[], a: number[], b: number[], fLo: number, fHi: number): number {
  let sumSq = 0;
  let count = 0;
  for (let i = 0; i < freqHz.length; i++) {
    if (freqHz[i] < fLo || freqHz[i] > fHi) continue;
    const d = a[i] - b[i];
    sumSq += d * d;
    count++;
  }
  return Math.sqrt(sumSq / count);
}

describe.each(['KEF R3', 'Genelec 8030C'])('computeCea2034 matches published CEA2034.txt for %s', (speaker) => {
  const { freqHz, plane: h } = loadNativePlane(speaker, 'SPL Horizontal.txt');
  const { plane: v } = loadNativePlane(speaker, 'SPL Vertical.txt');
  const ref = loadReference(speaker);
  const computed = computeCea2034(freqHz, h, v);

  const cases: [string, number[], number[]][] = [
    ['On Axis', computed.onAxis, ref['On Axis']],
    ['Listening Window', computed.listeningWindow, ref['Listening Window']],
    ['Early Reflections', computed.earlyReflections, ref['Early Reflections']],
    ['Sound Power', computed.soundPower, ref['Sound Power']],
    ['Sound Power DI', computed.soundPowerDi, ref['Sound Power DI']],
    ['Early Reflections DI', computed.earlyReflectionsDi, ref['Early Reflections DI']],
  ];

  it.each(cases)('%s is within 0.3dB RMS over 100Hz-16kHz', (_name, computedCurve, refCurve) => {
    const rms = rmsDiff(freqHz, computedCurve, refCurve, 100, 16000);
    expect(rms).toBeLessThan(0.3);
  });
});
