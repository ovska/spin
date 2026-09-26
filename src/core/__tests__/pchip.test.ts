import { describe, expect, it } from 'vitest';
import { pchip } from '../pchip';

describe('pchip', () => {
  it('matches the spec example: (0,-1.5,-5,-12) dB at (0,10,20,30)deg gives ~-2.93dB at 15deg', () => {
    const x = [0, 10, 20, 30];
    const y = [0, -1.5, -5, -12];
    const [v] = pchip(x, y, [15]);
    expect(v).toBeCloseTo(-2.93, 1);
  });

  it('never overshoots a monotonically decreasing run (no invented peak)', () => {
    const x = [0, 10, 20, 30];
    const y = [0, -1.5, -5, -12];
    const query = Array.from({ length: 61 }, (_, i) => i * 0.5);
    const values = pchip(x, y, query);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThanOrEqual(values[i - 1] + 1e-9);
    }
  });

  it('passes through the sampled nodes exactly', () => {
    const x = [0, 10, 20, 30];
    const y = [0, -1.5, -5, -12];
    const values = pchip(x, y, x);
    values.forEach((v, i) => expect(v).toBeCloseTo(y[i], 9));
  });
});
