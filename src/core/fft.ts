// Iterative radix-2 Cooley-Tukey FFT (decimation in time), in place. Used by
// minphase.ts's real-cepstrum method. N must be a power of two.

export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (im.length !== n) throw new Error('fft: re/im length mismatch');
  if (n === 0 || (n & (n - 1)) !== 0) throw new Error('fft: length must be a power of two');

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curWr = 1;
      let curWi = 0;
      for (let j = 0; j < half; j++) {
        const aIdx = i + j;
        const bIdx = i + j + half;
        const ur = re[aIdx];
        const ui = im[aIdx];
        const vr = re[bIdx] * curWr - im[bIdx] * curWi;
        const vi = re[bIdx] * curWi + im[bIdx] * curWr;
        re[aIdx] = ur + vr;
        im[aIdx] = ui + vi;
        re[bIdx] = ur - vr;
        im[bIdx] = ui - vi;
        const nextWr = curWr * wr - curWi * wi;
        const nextWi = curWr * wi + curWi * wr;
        curWr = nextWr;
        curWi = nextWi;
      }
    }
  }
}

/** Inverse FFT via the standard conjugate trick: conjugate the input,
 * forward FFT, conjugate again, scale by 1/n. */
export function ifft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 0; i < n; i++) im[i] = -im[i];
  fft(re, im);
  for (let i = 0; i < n; i++) {
    re[i] /= n;
    im[i] = -im[i] / n;
  }
}
