import { describe, expect, it } from 'vitest';
import { computePrefScoreMetrics } from '../prefScore';
import { buildLogGrid } from '../grid';

const GRID = buildLogGrid();

describe('computePrefScoreMetrics', () => {
  it('gives a flat response perfect smoothness and no low-frequency rolloff', () => {
    const flat = GRID.map(() => 0);
    const result = computePrefScoreMetrics({
      freqHz: GRID,
      onAxis: flat,
      listeningWindow: flat,
      soundPower: flat,
      estimatedInRoom: flat,
    });
    expect(result).not.toBeNull();
    expect(result!.smoothness).toBeCloseTo(1, 5);
    // Never drops -6dB below reference, so LFX falls back to the grid's
    // own lowest frequency.
    expect(result!.lfxHz).toBeCloseTo(GRID[0], 0);
  });

  it('detects a bass rolloff at roughly the expected -6dB crossing', () => {
    // Flat at 0dB above 100Hz, a steep dropoff towards low frequencies
    // crossing -6dB around 50Hz.
    const rolledOff = GRID.map((f) => (f >= 100 ? 0 : -24 * Math.log2(100 / f)));
    const result = computePrefScoreMetrics({
      freqHz: GRID,
      onAxis: rolledOff,
      listeningWindow: rolledOff,
      soundPower: rolledOff,
      estimatedInRoom: rolledOff,
    });
    expect(result).not.toBeNull();
    // -6dB at 24dB/octave from 100Hz is a quarter-octave down: 100 / 2^0.25.
    expect(result!.lfxHz).toBeGreaterThan(80);
    expect(result!.lfxHz).toBeLessThan(90);
  });

  it('returns null when a required curve is missing', () => {
    const flat = GRID.map(() => 0);
    expect(computePrefScoreMetrics({ freqHz: GRID, onAxis: flat })).toBeNull();
  });

  it('rewards a smoother in-room curve with a higher smoothness value', () => {
    const flat = GRID.map(() => 0);
    const bumpy = GRID.map((_, i) => (i % 2 === 0 ? 2 : -2));
    const smoothResult = computePrefScoreMetrics({
      freqHz: GRID,
      onAxis: flat,
      listeningWindow: flat,
      soundPower: flat,
      estimatedInRoom: flat,
    });
    const bumpyResult = computePrefScoreMetrics({
      freqHz: GRID,
      onAxis: flat,
      listeningWindow: flat,
      soundPower: flat,
      estimatedInRoom: bumpy,
    });
    expect(smoothResult!.smoothness).toBeGreaterThan(bumpyResult!.smoothness);
  });
});
