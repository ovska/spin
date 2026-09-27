import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseKlippelTxt } from '../klippel';
import { buildLogGrid } from '../grid';
import { resampleToGrid } from '../resample';
import { computeMinPhase, computeMinPhaseSpectrum, MINPHASE_FS } from '../minphase';

const RAW_DIR = join(import.meta.dirname, '..', '..', '..', 'data', 'raw');
const GRID = buildLogGrid();

function loadOnAxis(speaker: string): number[] {
  const text = readFileSync(join(RAW_DIR, speaker, 'asr', 'SPL Horizontal.txt'), 'utf-8');
  const parsed = parseKlippelTxt(text);
  const onAxis = parsed.traces.find((t) => t.name === 'On Axis')!;
  return resampleToGrid(onAxis.freqHz, onAxis.valueDb, GRID);
}

describe('computeMinPhaseSpectrum', () => {
  it('reconstructs the same magnitude it was given, within 0.1dB over 30Hz-15kHz', () => {
    const onAxisDb = loadOnAxis('KEF R3');
    const spectrum = computeMinPhaseSpectrum(GRID, onAxisDb);

    let maxDiff = 0;
    for (let k = 0; k < spectrum.freqHz.length; k++) {
      const f = spectrum.freqHz[k];
      if (f < 30 || f > 15000) continue;
      const diff = Math.abs(spectrum.reconstructedMagDb[k] - spectrum.magDb[k]);
      maxDiff = Math.max(maxDiff, diff);
    }
    expect(maxDiff).toBeLessThan(0.1);
  });

  it('produces a real-valued (not complex) impulse response', () => {
    const onAxisDb = loadOnAxis('Genelec 8030C');
    const spectrum = computeMinPhaseSpectrum(GRID, onAxisDb);
    // No imaginary part is exposed, but a real cepstrum fold should give an
    // impulse whose energy is concentrated near t=0, not spread uniformly -
    // sanity check that this isn't just numerical noise.
    const peak = Math.max(...Array.from(spectrum.impulse).map(Math.abs));
    const tailRms = Math.sqrt(
      Array.from(spectrum.impulse.subarray(spectrum.impulse.length / 2)).reduce((a, v) => a + v * v, 0) /
        (spectrum.impulse.length / 2),
    );
    expect(peak).toBeGreaterThan(tailRms * 10);
  });
});

describe('computeMinPhase', () => {
  const onAxisDb = loadOnAxis('KEF R3');
  const result = computeMinPhase(GRID, onAxisDb);

  it('stores exactly 0-20ms at 48kHz', () => {
    expect(result.timeMs[0]).toBe(0);
    expect(result.timeMs.length).toBe(Math.round(0.02 * MINPHASE_FS));
    expect(result.timeMs[result.timeMs.length - 1]).toBeCloseTo(20, 0);
  });

  it('has a step response that is the cumulative sum of the impulse', () => {
    let acc = 0;
    for (let i = 0; i < result.impulse.length; i++) {
      acc += result.impulse[i];
      expect(result.step[i]).toBeCloseTo(acc, 9);
    }
  });

  it('keeps the step response bounded (no folding/scaling blow-up)', () => {
    for (const v of result.step) {
      expect(Number.isFinite(v)).toBe(true);
      expect(Math.abs(v)).toBeLessThan(1e6);
    }
  });
});
