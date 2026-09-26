import { describe, expect, it } from 'vitest';
import { angleLabelToDeg, estimateOffPlane, interpolatePlaneAngles, percentile } from '../angles';
import type { Plane } from '../cea2034';

describe('angleLabelToDeg', () => {
  it('parses On Axis and signed degree labels', () => {
    expect(angleLabelToDeg('On Axis')).toBe(0);
    expect(angleLabelToDeg('10°')).toBe(10);
    expect(angleLabelToDeg('-30°')).toBe(-30);
    expect(angleLabelToDeg('180°')).toBe(180);
  });
});

describe('interpolatePlaneAngles', () => {
  it('reproduces the spec worked example at a single frequency', () => {
    const plane: Plane = {
      'On Axis': [0],
      '10°': [-1.5],
      '20°': [-5],
      '30°': [-12],
    };
    const [curve] = interpolatePlaneAngles(plane, 1, [15]);
    expect(curve[0]).toBeCloseTo(-2.93, 1);
  });

  it('returns the measured value exactly at a measured angle, across frequencies', () => {
    const plane: Plane = {
      'On Axis': [0, 1, 2],
      '10°': [-1, -1, -1],
      '-10°': [-1, -1, -1],
      '20°': [-4, -3, -2],
      '-20°': [-4, -3, -2],
    };
    const [curve] = interpolatePlaneAngles(plane, 3, [20]);
    expect(curve).toEqual([-4, -3, -2]);
  });
});

describe('estimateOffPlane', () => {
  it('reduces to the horizontal curve when v=0 (vCurve equals onAxis)', () => {
    const h = [1, 2, 3];
    const onAxis = [0.5, 0.5, 0.5];
    expect(estimateOffPlane(h, onAxis, onAxis)).toEqual(h);
  });

  it('reduces to the vertical curve when h=0 (hCurve equals onAxis)', () => {
    const v = [1, 2, 3];
    const onAxis = [0.5, 0.5, 0.5];
    expect(estimateOffPlane(onAxis, v, onAxis)).toEqual(v);
  });

  it('adds the two off-axis deltas otherwise', () => {
    const h = [2];
    const v = [3];
    const onAxis = [1];
    expect(estimateOffPlane(h, v, onAxis)).toEqual([4]); // 2 + 3 - 1
  });
});

describe('percentile', () => {
  it('returns exact values at rank boundaries', () => {
    const sorted = [1, 2, 3, 4, 5];
    expect(percentile(sorted, 0)).toBe(1);
    expect(percentile(sorted, 1)).toBe(5);
    expect(percentile(sorted, 0.5)).toBe(3);
  });

  it('interpolates between ranks', () => {
    const sorted = [0, 10];
    expect(percentile(sorted, 0.25)).toBeCloseTo(2.5);
    expect(percentile(sorted, 0.75)).toBeCloseTo(7.5);
  });
});
