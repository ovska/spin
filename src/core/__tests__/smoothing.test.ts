import { describe, expect, it } from 'vitest';
import { buildLogGrid } from '../grid';
import { smoothPowerDomain } from '../smoothing';

describe('smoothPowerDomain', () => {
  const grid = buildLogGrid();

  it('leaves a flat curve unchanged', () => {
    const flat = grid.map(() => -3);
    const smoothed = smoothPowerDomain(grid, flat, '1/3');
    smoothed.forEach((v) => expect(v).toBeCloseTo(-3, 6));
  });

  it('is a no-op for mode "none"', () => {
    const curve = grid.map((f) => Math.sin(f));
    expect(smoothPowerDomain(grid, curve, 'none')).toEqual(curve);
  });

  it('reduces a single-point spike', () => {
    const curve = grid.map(() => 0);
    const spikeIdx = Math.floor(grid.length / 2);
    curve[spikeIdx] = 20;
    const smoothed = smoothPowerDomain(grid, curve, '1/3');
    expect(smoothed[spikeIdx]).toBeLessThan(15);
    expect(smoothed[spikeIdx]).toBeGreaterThan(0);
  });

  it('has a wider window (in octaves) at low frequencies than high for ERB', () => {
    // ERB bandwidth grows with frequency in absolute Hz, but shrinks as a
    // fraction of an octave, matching critical bands being relatively
    // coarser at bass and finer at treble.
    const curve = grid.map(() => 0);
    const loIdx = grid.findIndex((f) => f > 100);
    const hiIdx = grid.findIndex((f) => f > 8000);
    curve[loIdx] = 10;
    curve[hiIdx] = 10;
    const smoothed = smoothPowerDomain(grid, curve, 'erb');
    expect(smoothed[loIdx]).toBeLessThan(smoothed[hiIdx]);
  });
});
