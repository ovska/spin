// Shared energy-domain (pressure, not dB) helpers. Averaging sound levels
// must happen in pressure-squared space and be converted back to dB
// afterward - averaging dB values directly is a different (wrong) quantity.

export function splToPressure(spl: number): number {
  return Math.pow(10, (spl - 105.0) / 20.0);
}

export function pressureToSpl(pressure: number): number {
  return 105.0 + 20.0 * Math.log10(pressure);
}

/** Energy-average several curves (optionally weighted) index-wise. */
export function energyAverage(curves: number[][], weights?: number[]): number[] {
  const n = curves[0]?.length ?? 0;
  const out = new Array<number>(n);
  const w = weights ?? curves.map(() => 1);
  const wSum = w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let c = 0; c < curves.length; c++) {
      const p = splToPressure(curves[c][i]);
      acc += w[c] * p * p;
    }
    out[i] = pressureToSpl(Math.sqrt(acc / wSum));
  }
  return out;
}
