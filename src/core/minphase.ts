// Minimum-phase impulse/step response from the on-axis magnitude alone, via
// the real-cepstrum method: interpolate the magnitude onto a linear FFT
// grid, take its log-spectrum, fold the cepstrum to synthesize a minimum-
// phase spectrum with the same magnitude, then inverse-FFT back to time.

import { fft, ifft } from './fft.ts';
import { resampleToGrid } from './resample.ts';

export const MINPHASE_N = 65536;
export const MINPHASE_FS = 48000;
const MIN_EXTRAP_FREQ_HZ = 1;
const HIGH_TAPER_DROP_DB = 40;
const SLOPE_FIT_POINTS = 12;

/** Least-squares slope in dB per octave, fit over the first/last `count`
 * points of an (freqHz, db) curve - more robust to measurement noise at the
 * very ends than a two-point difference. */
function fitSlope(freqHz: number[], db: number[], count: number, fromStart: boolean): number {
  const n = freqHz.length;
  const c = Math.min(count, n);
  const start = fromStart ? 0 : n - c;
  const xs = new Array(c);
  const ys = new Array(c);
  for (let i = 0; i < c; i++) {
    xs[i] = Math.log2(freqHz[start + i]);
    ys[i] = db[start + i];
  }
  const meanX = xs.reduce((a: number, b: number) => a + b, 0) / c;
  const meanY = ys.reduce((a: number, b: number) => a + b, 0) / c;
  let num = 0;
  let den = 0;
  for (let i = 0; i < c; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export interface MinPhaseSpectrum {
  /** Linear-grid bin frequencies, 0..Nyquist, length N/2+1. */
  freqHz: Float64Array;
  /** Magnitude (dB) actually fed to the cepstrum: measured in the middle,
   * slope-extended below 20Hz, cosine-tapered above the top measured
   * frequency. */
  magDb: Float64Array;
  /** Magnitude (dB) of the reconstructed minimum-phase spectrum - should
   * equal magDb almost exactly, by construction of the method. */
  reconstructedMagDb: Float64Array;
  /** Full N-sample minimum-phase impulse response. */
  impulse: Float64Array;
}

/** freqHz/onAxisDb must be the shared log grid (20Hz-20kHz) - ascending,
 * matching src/core/grid.ts. */
export function computeMinPhaseSpectrum(
  freqHz: number[],
  onAxisDb: number[],
  N = MINPHASE_N,
  fs = MINPHASE_FS,
): MinPhaseSpectrum {
  const halfN = N / 2;
  const binFreq = new Float64Array(halfN + 1);
  for (let k = 0; k <= halfN; k++) binFreq[k] = (k * fs) / N;

  const loRefFreq = freqHz[0];
  const loRefDb = onAxisDb[0];
  const hiRefFreq = freqHz[freqHz.length - 1];
  const hiRefDb = onAxisDb[onAxisDb.length - 1];
  const loSlope = fitSlope(freqHz, onAxisDb, SLOPE_FIT_POINTS, true);

  const magDb = new Float64Array(halfN + 1);

  const midIdxs: number[] = [];
  const midFreqs: number[] = [];
  for (let k = 0; k <= halfN; k++) {
    if (binFreq[k] >= loRefFreq && binFreq[k] <= hiRefFreq) {
      midIdxs.push(k);
      midFreqs.push(binFreq[k]);
    }
  }
  const midValues = resampleToGrid(freqHz, onAxisDb, midFreqs);
  midIdxs.forEach((k, i) => {
    magDb[k] = midValues[i];
  });

  // Below the lowest measured frequency (down to and including DC):
  // continue the measured low-frequency slope, in dB per octave. Clamped to
  // a small nonzero floor frequency so log2(f) doesn't diverge at f -> 0.
  for (let k = 0; k <= halfN; k++) {
    if (binFreq[k] < loRefFreq) {
      const f = Math.max(binFreq[k], MIN_EXTRAP_FREQ_HZ);
      magDb[k] = loRefDb + loSlope * Math.log2(f / loRefFreq);
    }
  }

  // Above the highest measured frequency: a smooth (zero-slope-at-both-ends)
  // cosine taper down to a fixed floor, rather than continuing whatever the
  // measured high-frequency slope happens to be - this is deliberately a
  // fade toward quiet, not an extrapolation, so it can't accidentally ramp
  // back up toward Nyquist.
  const taperFloorDb = hiRefDb - HIGH_TAPER_DROP_DB;
  const taperSpan = fs / 2 - hiRefFreq;
  for (let k = 0; k <= halfN; k++) {
    if (binFreq[k] > hiRefFreq) {
      const t = taperSpan > 0 ? Math.min(1, (binFreq[k] - hiRefFreq) / taperSpan) : 1;
      const w = 0.5 * (1 + Math.cos(Math.PI * t));
      magDb[k] = taperFloorDb + (hiRefDb - taperFloorDb) * w;
    }
  }

  // Full symmetric log-magnitude spectrum (natural log of linear magnitude:
  // ln(10^(dB/20)) = dB * ln(10)/20).
  const logMagFull = new Float64Array(N);
  const LN10_OVER_20 = Math.LN10 / 20;
  for (let k = 0; k <= halfN; k++) logMagFull[k] = magDb[k] * LN10_OVER_20;
  for (let k = 1; k < halfN; k++) logMagFull[N - k] = logMagFull[k];

  // Real cepstrum.
  const cepRe = Float64Array.from(logMagFull);
  const cepIm = new Float64Array(N);
  ifft(cepRe, cepIm);

  // Fold: keep DC and Nyquist, double positive quefrency, zero negative
  // quefrency - the standard homomorphic minimum-phase construction.
  const foldedRe = new Float64Array(N);
  foldedRe[0] = cepRe[0];
  foldedRe[halfN] = cepRe[halfN];
  for (let n = 1; n < halfN; n++) foldedRe[n] = 2 * cepRe[n];
  const foldedIm = new Float64Array(N);

  fft(foldedRe, foldedIm); // complex minimum-phase log-spectrum

  const xRe = new Float64Array(N);
  const xIm = new Float64Array(N);
  for (let k = 0; k < N; k++) {
    const mag = Math.exp(foldedRe[k]);
    xRe[k] = mag * Math.cos(foldedIm[k]);
    xIm[k] = mag * Math.sin(foldedIm[k]);
  }

  const reconstructedMagDb = new Float64Array(halfN + 1);
  for (let k = 0; k <= halfN; k++) reconstructedMagDb[k] = 20 * Math.log10(Math.hypot(xRe[k], xIm[k]));

  ifft(xRe, xIm); // xRe: minimum-phase impulse response (xIm ~ 0)

  return { freqHz: binFreq, magDb, reconstructedMagDb, impulse: xRe };
}

export interface MinPhaseResult {
  timeMs: number[];
  impulse: number[];
  step: number[];
}

const STORE_DURATION_MS = 20;

export function computeMinPhase(freqHz: number[], onAxisDb: number[]): MinPhaseResult {
  const spectrum = computeMinPhaseSpectrum(freqHz, onAxisDb);
  const count = Math.round((STORE_DURATION_MS / 1000) * MINPHASE_FS);

  const impulse = Array.from(spectrum.impulse.subarray(0, count));
  const step = new Array<number>(count);
  let acc = 0;
  for (let i = 0; i < count; i++) {
    acc += impulse[i];
    step[i] = acc;
  }
  const timeMs = Array.from({ length: count }, (_, i) => (i * 1000) / MINPHASE_FS);

  return { timeMs, impulse, step };
}
