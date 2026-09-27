import uPlot from 'uplot';
import { AXIS_COLOR, GRID_COLOR } from './palette';

const FREQ_TICKS = [20, 30, 50, 70, 100, 200, 300, 500, 700, 1000, 2000, 3000, 5000, 7000, 10000, 20000];

function formatFreq(hz: number): string {
  if (hz >= 1000) {
    const k = hz / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  return String(hz);
}

export function freqAxisSplits(u: uPlot, _axisIdx: number): number[] {
  const min = u.scales.x.min ?? 20;
  const max = u.scales.x.max ?? 20000;
  return FREQ_TICKS.filter((f) => f >= min && f <= max);
}

// uPlot nulls out entries here (not in freqAxisSplits' own return value) when
// two labels would collide - those must render as blank, not "null".
export function freqAxisValues(_u: uPlot, splits: (number | null)[]): string[] {
  return splits.map((f) => (f == null ? '' : formatFreq(f)));
}

/** Shared uPlot options: log frequency x axis, no built-in drag/zoom box (a
 * custom gesture handler owns pan/pinch), no point markers, no legend, and
 * no cursor crosshair (this is a quick-eyeballing tool, not a
 * precise-readout one - a hover line with nothing to read at it would just
 * be confusing), touch-action left to the caller's CSS. */
export function baseOptions(width: number, height: number): Partial<uPlot.Options> {
  return {
    width,
    height,
    padding: [8, 8, 0, 0],
    legend: { show: false },
    cursor: { show: false },
    scales: {
      // uPlot re-invokes range() for the x-scale on every commit (not just
      // the first auto-scale), passing the scale's current min/max as
      // initMin/initMax - so a range fn that ignores those args and always
      // returns a fixed pair (needed to stop log-scale auto-ranging from
      // snapping 20000 up to the next decade, 100000) also stomps every
      // explicit u.setScale('x', ...) call a moment after it lands. Passing
      // initMin/initMax back through once they're non-null keeps the fixed
      // default for the very first auto-scale while still letting zoom/pan
      // stick.
      x: { time: false, distr: 3, range: (_u, initMin, initMax) => (initMin == null ? [20, 20000] : [initMin, initMax]) },
    },
    axes: [
      {
        stroke: AXIS_COLOR,
        grid: { stroke: GRID_COLOR, width: 1 },
        ticks: { stroke: AXIS_COLOR },
        splits: freqAxisSplits,
        values: freqAxisValues,
      },
      {
        stroke: AXIS_COLOR,
        grid: { stroke: GRID_COLOR, width: 1 },
        ticks: { stroke: AXIS_COLOR },
      },
    ],
  };
}
