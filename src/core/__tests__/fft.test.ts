import { describe, expect, it } from 'vitest';
import { fft, ifft } from '../fft';

describe('fft', () => {
  it('transforms a unit impulse to a flat spectrum', () => {
    const n = 16;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    re[0] = 1;
    fft(re, im);
    for (let i = 0; i < n; i++) {
      expect(re[i]).toBeCloseTo(1, 9);
      expect(im[i]).toBeCloseTo(0, 9);
    }
  });

  it('concentrates a pure cosine at bins k0 and n-k0', () => {
    const n = 32;
    const k0 = 3;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = Math.cos((2 * Math.PI * k0 * i) / n);
    fft(re, im);
    for (let k = 0; k < n; k++) {
      const mag = Math.hypot(re[k], im[k]);
      if (k === k0 || k === n - k0) expect(mag).toBeCloseTo(n / 2, 6);
      else expect(mag).toBeLessThan(1e-6);
    }
  });

  it('round-trips an arbitrary signal through fft then ifft', () => {
    const n = 64;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    const original = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      original[i] = Math.sin(i) * 3 + (i % 5) - 2;
      re[i] = original[i];
    }
    fft(re, im);
    ifft(re, im);
    for (let i = 0; i < n; i++) {
      expect(re[i]).toBeCloseTo(original[i], 9);
      expect(im[i]).toBeCloseTo(0, 9);
    }
  });

  it('rejects a non-power-of-two length', () => {
    expect(() => fft(new Float64Array(10), new Float64Array(10))).toThrow();
  });
});
