// Monotone cubic Hermite interpolation (Fritsch-Carlson PCHIP). Unlike a
// natural cubic spline, PCHIP never overshoots between samples, so it cannot
// invent a peak between two measured angles.

function sign(x: number): number {
  return x > 0 ? 1 : x < 0 ? -1 : 0;
}

/** Derivatives at each node for monotone cubic Hermite interpolation. */
function pchipSlopes(x: number[], y: number[]): number[] {
  const n = x.length;
  const h: number[] = [];
  const delta: number[] = [];
  for (let k = 0; k < n - 1; k++) {
    h.push(x[k + 1] - x[k]);
    delta.push((y[k + 1] - y[k]) / h[k]);
  }

  const d = new Array<number>(n);

  if (n === 2) {
    d[0] = d[1] = delta[0];
    return d;
  }

  for (let k = 1; k < n - 1; k++) {
    if (sign(delta[k - 1]) !== sign(delta[k]) || delta[k - 1] === 0 || delta[k] === 0) {
      d[k] = 0;
    } else {
      const w1 = 2 * h[k] + h[k - 1];
      const w2 = h[k] + 2 * h[k - 1];
      d[k] = (w1 + w2) / (w1 / delta[k - 1] + w2 / delta[k]);
    }
  }

  // Non-centered endpoint estimate, clipped to preserve monotonicity/shape.
  const endSlope = (hEnd: number, hNext: number, dEnd: number, dNext: number): number => {
    let m = ((2 * hEnd + hNext) * dEnd - hEnd * dNext) / (hEnd + hNext);
    if (sign(m) !== sign(dEnd)) {
      m = 0;
    } else if (sign(dEnd) !== sign(dNext) && Math.abs(m) > Math.abs(3 * dEnd)) {
      m = 3 * dEnd;
    }
    return m;
  };

  d[0] = endSlope(h[0], h[1], delta[0], delta[1]);
  d[n - 1] = endSlope(h[n - 2], h[n - 3], delta[n - 2], delta[n - 3]);

  return d;
}

/** Evaluate the PCHIP interpolant of (x, y) at each point in xq.
 * x must be strictly increasing. Queries outside [x[0], x[n-1]] are clamped. */
export function pchip(x: number[], y: number[], xq: number[]): number[] {
  const n = x.length;
  if (n === 1) return xq.map(() => y[0]);
  const d = pchipSlopes(x, y);

  let j = 0;
  return xq.map((xi) => {
    if (xi <= x[0]) return y[0];
    if (xi >= x[n - 1]) return y[n - 1];
    while (j < n - 2 && x[j + 1] < xi) j++;
    while (j > 0 && x[j] > xi) j--;
    const h = x[j + 1] - x[j];
    const t = (xi - x[j]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    return h00 * y[j] + h10 * h * d[j] + h01 * y[j + 1] + h11 * h * d[j + 1];
  });
}

/** PCHIP interpolation over a periodic angle domain (period 360°). anglesDeg
 * must be sorted ascending and cover the full circle at consistent steps
 * (e.g. -180..180 in 10° increments); values are dB. */
export function pchipPeriodic(anglesDeg: number[], valuesDb: number[], queryDeg: number[]): number[] {
  const n = anglesDeg.length;
  const period = 360;
  // Pad with a couple of points on each side, wrapped by one period, so the
  // interpolant sees real neighbors across the seam instead of a boundary.
  const pad = Math.min(2, n - 1);
  const x: number[] = [];
  const y: number[] = [];
  for (let k = n - pad; k < n; k++) {
    x.push(anglesDeg[k] - period);
    y.push(valuesDb[k]);
  }
  for (let k = 0; k < n; k++) {
    x.push(anglesDeg[k]);
    y.push(valuesDb[k]);
  }
  for (let k = 0; k < pad; k++) {
    x.push(anglesDeg[k] + period);
    y.push(valuesDb[k]);
  }

  const wrapped = queryDeg.map((q) => {
    let a = q;
    while (a < x[0]) a += period;
    while (a > x[x.length - 1]) a -= period;
    return a;
  });

  return pchip(x, y, wrapped);
}
