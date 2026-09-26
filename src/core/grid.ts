// The common log-frequency grid every measurement is resampled onto:
// 1/48 octave, 20 Hz to 20 kHz.

export const GRID_FMIN = 20;
export const GRID_FMAX = 20000;
export const GRID_POINTS_PER_OCTAVE = 48;

export function buildLogGrid(
  fMin = GRID_FMIN,
  fMax = GRID_FMAX,
  pointsPerOctave = GRID_POINTS_PER_OCTAVE,
): number[] {
  const octaves = Math.log2(fMax / fMin);
  const steps = Math.round(octaves * pointsPerOctave);
  const grid: number[] = [];
  for (let k = 0; k <= steps; k++) {
    grid.push(fMin * Math.pow(2, k / pointsPerOctave));
  }
  return grid;
}
