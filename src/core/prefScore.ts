// A simplified version of spinorama's preference-score pipeline
// (src/spinorama/compute/scores.py in github.com/pierreaubert/spinorama,
// pinned at acc757b), ported to run on our own resampled 1/48-octave grid
// instead of each measurement's native frequency points. Formulas and the
// regression constants are theirs (from Olive's 2004/2013 published
// preference-rating research); results will be close to, but not
// necessarily bit-identical with, the values spinorama.org itself shows
// for the same speaker, since the source data isn't the same grid.
//
// Three metrics feed the sort options in SpeakerPicker: prefScore (overall
// "how close to the Harman-preferred target response"), lfxHz (low
// frequency extension - lower is deeper bass), and smoothness (0-1, higher
// is a flatter/less bumpy response).

interface Band {
  min: number;
  center: number;
  max: number;
}

/** 1/count-octave bands centered on a fixed reference, wide enough to
 * cover 20Hz-20kHz - mirrors spinorama's octave(count). */
function octaveBands(count: number): Band[] {
  const reference = 1290;
  const p = Math.pow(2, 1 / count);
  const pBand = Math.pow(2, 1 / (2 * count));
  const oIter = Math.floor((count * 10 + 1) / 2);
  const centers: number[] = [];
  for (let i = oIter; i >= 1; i--) centers.push(reference / Math.pow(p, i));
  centers.push(reference);
  for (let i = 1; i <= oIter; i++) centers.push(reference * Math.pow(p, i));
  return centers.map((c) => ({ min: c / pBand, center: c, max: c * pBand }));
}

const HALF_OCTAVE_BANDS = octaveBands(2);

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Mean absolute deviation from the mean. */
function mad(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const m = mean(xs);
  return mean(xs.map((x) => Math.abs(x - m)));
}

function valuesInBand(freqHz: number[], db: number[], lo: number, hi: number, hiInclusive: boolean): number[] {
  const out: number[] = [];
  for (let i = 0; i < freqHz.length; i++) {
    const f = freqHz[i];
    if (f >= lo && (hiInclusive ? f <= hi : f < hi)) out.push(db[i]);
  }
  return out;
}

/** Narrow Band Deviation: mean, across 1/2-octave bands from 100Hz (or
 * minFreq if higher) to 12kHz, of the mean absolute deviation within each
 * band - how bumpy the curve is at a "half octave" scale. */
function nbd(freqHz: number[], db: number[], minFreq: number): number {
  const bandMinFreq = Math.max(100, minFreq);
  const mads: number[] = [];
  for (const band of HALF_OCTAVE_BANDS) {
    if (band.center < bandMinFreq || band.center > 12000) continue;
    const values = valuesInBand(freqHz, db, band.min, band.max, true);
    const m = mad(values);
    if (Number.isFinite(m)) mads.push(m);
  }
  return mean(mads);
}

const LFX_DEFAULT = Math.log10(300);

/** Low Frequency Extension: log10 of the frequency just above the first
 * contiguous run (scanning up from 20Hz) where the sound power curve is
 * >=6dB below the 300Hz-10kHz listening-window average. For a typical
 * clean rolloff there's exactly one such run (below cutoff = quiet, above
 * = normal), so "first" is also "only"; this mirrors spinorama's own
 * `next(consecutive_groups(...))`, first-group behavior and all, rather
 * than assuming what its "oscillating bass" comment intends but its code
 * doesn't actually do. */
function lfx(lwFreqHz: number[], lwDb: number[], spFreqHz: number[], spDb: number[]): number {
  const lwBand = valuesInBand(lwFreqHz, lwDb, 300, 10000, true);
  const lwRef = mean(lwBand) - 6;

  const below: boolean[] = spFreqHz.map((f, i) => f <= 300 && spDb[i] <= lwRef);
  let runStart = -1;
  let runEnd = -1;
  for (let i = 0; i < below.length; i++) {
    if (below[i]) {
      if (runStart === -1) runStart = i;
      runEnd = i;
    } else if (runStart !== -1) {
      break; // closed the first run
    }
  }
  if (runStart === -1) {
    // Bass never drops -6dB below the reference within the measured range.
    return spFreqHz.length > 0 ? Math.log10(spFreqHz[0]) : LFX_DEFAULT;
  }
  const nextIdx = runEnd + 1;
  if (nextIdx >= spFreqHz.length) return LFX_DEFAULT;
  return Math.log10(spFreqHz[nextIdx]);
}

const REFERENCE_SLOPE_PER_DECADE = -Math.log(10);

/** Smoothness: R^2 of how well a straight line (in dB vs log10 Hz) fits
 * the 100Hz-16kHz curve, after normalizing out the reference -1-per-decade
 * slope VituixCAD/spinorama use - 0 to 1, higher is smoother. */
function smoothness(freqHz: number[], db: number[]): number {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < freqHz.length; i++) {
    if (freqHz[i] >= 100 && freqHz[i] <= 16000) {
      xs.push(Math.log10(freqHz[i]));
      ys.push(db[i]);
    }
  }
  if (xs.length < 2) return 1;

  const xMean = mean(xs);
  const yMean = mean(ys);
  const ssXX = xs.reduce((s, x) => s + (x - xMean) ** 2, 0);
  const ssYY = ys.reduce((s, y) => s + (y - yMean) ** 2, 0);
  if (ssXX === 0 || ssYY === 0) return 1;

  const ssXY = xs.reduce((s, x, i) => s + (x - xMean) * (ys[i] - yMean), 0);
  const slope = ssXY / ssXX;

  const normalizedY = ys.map((y, i) => y + xs[i] * (REFERENCE_SLOPE_PER_DECADE - slope));
  const nyMean = mean(normalizedY);
  const nSsYY = normalizedY.reduce((s, y) => s + (y - nyMean) ** 2, 0);
  const nSsXY = normalizedY.reduce((s, y, i) => s + (xs[i] - xMean) * (y - nyMean), 0);
  const nSlope = nSsXY / ssXX;
  const nIntercept = nyMean - nSlope * xMean;
  const ssRes = normalizedY.reduce((s, y, i) => s + (y - (nIntercept + nSlope * xs[i])) ** 2, 0);

  const r2 = 1 - ssRes / nSsYY;
  return Math.max(0, Math.min(1, r2));
}

/** 12.69 - 2.49*NBD(on-axis) - 2.99*NBD(PIR) - 4.31*log10(LFX Hz) +
 * 2.32*SM(PIR) - Olive's 2013 multiple-regression preference-rating
 * formula (the "with subwoofer" variant, i.e. not penalized for a high
 * LFX - see spinorama's pref_wsub for why: most of these speakers are
 * measured standalone and would otherwise be unfairly punished for bass
 * they're not expected to reproduce alone). */
function prefRating(nbdOn: number, nbdPir: number, lfxLog10: number, smPir: number): number {
  return 12.69 - 2.49 * nbdOn - 2.99 * nbdPir - 4.31 * lfxLog10 + 2.32 * smPir;
}

export interface PrefScoreMetrics {
  prefScore: number;
  lfxHz: number;
  smoothness: number;
}

interface Cea2034Curves {
  freqHz: number[];
  onAxis?: number[];
  listeningWindow?: number[];
  soundPower?: number[];
  estimatedInRoom?: number[];
}

/** null when any required curve is missing, or the measurement doesn't
 * extend low enough for the low-frequency terms to mean anything (matches
 * spinorama's own >=40Hz guard) - callers should treat this speaker as
 * unscored rather than showing a misleading value. */
export function computePrefScoreMetrics(cea: Cea2034Curves): PrefScoreMetrics | null {
  const { freqHz, onAxis, listeningWindow, soundPower, estimatedInRoom } = cea;
  if (!onAxis || !listeningWindow || !soundPower || !estimatedInRoom) return null;
  if (freqHz.length === 0 || freqHz[0] >= 40) return null;

  const minFreq = freqHz[0];
  const nbdOn = nbd(freqHz, onAxis, minFreq);
  const nbdPir = nbd(freqHz, estimatedInRoom, minFreq);
  const lfxLog10 = lfx(freqHz, listeningWindow, freqHz, soundPower);
  const smPir = smoothness(freqHz, estimatedInRoom);

  if (!Number.isFinite(nbdOn) || !Number.isFinite(nbdPir) || !Number.isFinite(smPir)) return null;

  return {
    prefScore: prefRating(nbdOn, nbdPir, lfxLog10, smPir),
    lfxHz: Math.round(Math.pow(10, lfxLog10)),
    smoothness: smPir,
  };
}
