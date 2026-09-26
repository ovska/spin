// Discrete 3dB-band sequential palette for the off-axis heatmap, from -30dB
// (quiet off-axis) to +3dB (louder than on-axis) relative to on-axis.
// Single hue family with monotonically increasing lightness, so the bands
// stay ordered under the common color-vision deficiencies, not just to
// full-color vision.

export const HEATMAP_BAND_MIN = -30;
export const HEATMAP_BAND_MAX = 3;
export const HEATMAP_BAND_STEP = 3;
const BAND_COUNT = (HEATMAP_BAND_MAX - HEATMAP_BAND_MIN) / HEATMAP_BAND_STEP;

function hslToHex(h: number, s: number, l: number): string {
  const a = (s * Math.min(l, 1 - l)) / 1;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export const HEATMAP_COLORS: string[] = Array.from({ length: BAND_COUNT }, (_, i) => {
  const t = i / (BAND_COUNT - 1);
  const hue = 260 - t * 200; // indigo (260) -> green -> yellow (~60)
  const lightness = 0.18 + t * 0.62;
  return hslToHex(hue, 0.75, lightness);
});

export function heatmapColorForValue(v: number): string {
  const clamped = Math.min(HEATMAP_BAND_MAX, Math.max(HEATMAP_BAND_MIN, v));
  const idx = Math.min(
    HEATMAP_COLORS.length - 1,
    Math.floor((clamped - HEATMAP_BAND_MIN) / HEATMAP_BAND_STEP),
  );
  return HEATMAP_COLORS[idx];
}
