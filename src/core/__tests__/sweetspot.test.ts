import { describe, expect, it } from 'vitest';
import { computeSweetSpot, geometryToWindow } from '../sweetspot';
import type { Plane } from '../cea2034';

describe('geometryToWindow', () => {
  it('centers the vertical window at 0 when ear and tweeter heights match', () => {
    const w = geometryToWindow({
      distanceCm: 200,
      tweeterHeightCm: 100,
      earHeightCm: 100,
      headMoveHCm: 0,
      headMoveVCm: 0,
      toeInDeg: 0,
    });
    expect(w.vMin).toBeCloseTo(0);
    expect(w.vMax).toBeCloseTo(0);
    expect(w.hMin).toBeCloseTo(0);
    expect(w.hMax).toBeCloseTo(0);
  });

  it('widens the window with head movement and centers on toe-in', () => {
    const w = geometryToWindow({
      distanceCm: 200,
      tweeterHeightCm: 100,
      earHeightCm: 100,
      headMoveHCm: 20,
      headMoveVCm: 10,
      toeInDeg: 5,
    });
    expect(w.hMax - w.hMin).toBeGreaterThan(0);
    expect((w.hMin + w.hMax) / 2).toBeCloseTo(5, 5);
    expect(w.vMax - w.vMin).toBeGreaterThan(0);
  });

  it('gives a positive vertical center when the ear sits above the tweeter', () => {
    const w = geometryToWindow({
      distanceCm: 200,
      tweeterHeightCm: 90,
      earHeightCm: 100,
      headMoveHCm: 0,
      headMoveVCm: 0,
      toeInDeg: 0,
    });
    expect(w.vMin).toBeGreaterThan(0);
  });
});

describe('computeSweetSpot', () => {
  it('collapses to a single flat value when the plane is flat everywhere', () => {
    const flatAngles = ['On Axis', '10°', '-10°', '20°', '-20°', '30°', '-30°'];
    const h: Plane = Object.fromEntries(flatAngles.map((a) => [a, [0, 0]]));
    const v: Plane = Object.fromEntries(flatAngles.map((a) => [a, [0, 0]]));
    const onAxis = [0, 0];

    const result = computeSweetSpot(h, v, onAxis, 2, { hMin: -10, hMax: 10, vMin: -10, vMax: 10 });
    expect(result.average).toEqual([0, 0]);
    expect(result.min).toEqual([0, 0]);
    expect(result.max).toEqual([0, 0]);
    expect(result.p25).toEqual([0, 0]);
    expect(result.p75).toEqual([0, 0]);
  });

  it('produces min <= p25 <= p75 <= max at every frequency', () => {
    const angles = ['On Axis', '10°', '-10°', '20°', '-20°', '30°', '-30°'];
    const h: Plane = Object.fromEntries(angles.map((a, i) => [a, [i, -i]]));
    const v: Plane = Object.fromEntries(angles.map((a, i) => [a, [-i, i]]));
    const onAxis = [0, 0];

    const result = computeSweetSpot(h, v, onAxis, 2, { hMin: -20, hMax: 20, vMin: -15, vMax: 15 });
    for (let f = 0; f < 2; f++) {
      expect(result.min[f]).toBeLessThanOrEqual(result.p25[f] + 1e-9);
      expect(result.p25[f]).toBeLessThanOrEqual(result.p75[f] + 1e-9);
      expect(result.p75[f]).toBeLessThanOrEqual(result.max[f] + 1e-9);
    }
  });
});
