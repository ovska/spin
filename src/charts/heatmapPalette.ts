// Continuous sequential palette for the off-axis heatmap: single hue family
// (indigo -> green -> yellow), with monotonically increasing lightness so
// values stay ordered under the common color-vision deficiencies, mapped
// onto whatever [min, max] dB range the caller supplies. The range is
// picked per-view from the actual spread of the selected speakers' data
// (see OffAxisHeatmapController) rather than fixed, since most speakers'
// off-axis deviation never gets close to a fixed wide range and would
// otherwise render as one or two colors the whole time.

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

export function heatmapRgbForValue(v: number, min: number, max: number): [number, number, number] {
  const t = max > min ? Math.min(1, Math.max(0, (v - min) / (max - min))) : 0.5;
  const hue = 260 - t * 200; // indigo (260) -> green -> yellow (~60)
  const lightness = 0.18 + t * 0.62;
  return hslToRgb(hue, 0.75, lightness);
}
