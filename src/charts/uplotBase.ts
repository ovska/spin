import uPlot from 'uplot';
import { AXIS_COLOR, GRID_COLOR } from './palette';
import { GRID_FMIN, GRID_FMAX } from '../core/grid';
import { xRange } from '../state/settings';

// Every integer multiple of a power of ten within the domain (20, 30, ...,
// 90, 100, 200, ..., 900, 1000, ...) - a full decade grid, not just the
// "1-2-3-5-7" subset. uPlot draws a gridline for every entry here
// regardless of which labels freqAxisValues nulls out for collision, so
// this only densifies the lines; the labels shown still thin themselves
// out automatically.
const FREQ_TICKS: number[] = [10, 100, 1000, 10000].flatMap((decadeStart) =>
  Array.from({ length: 9 }, (_, i) => decadeStart * (i + 1)).filter((f) => f >= GRID_FMIN && f <= GRID_FMAX),
);

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
      // returns a fixed pair also stomps every explicit u.setScale('x', ...)
      // call a moment after it lands. Passing initMin/initMax back through
      // once they're non-null lets zoom/pan stick.
      //
      // The very first auto-scale (initMin == null) reads the live xRange
      // signal instead of a hardcoded default: a brand-new uPlot instance's
      // own first-ready pass runs asynchronously and can win the race
      // against the setXRange() effect that's supposed to correct it
      // afterwards (confirmed by tracing - switching tabs recreates each
      // view's chart from scratch, and the newly-created chart would flash
      // to full range before/instead of picking up the shared zoom, even
      // though the effect did fire with the right value). Reading the
      // signal here means the very first auto-scale is already correct, no
      // race to lose.
      //
      // auto: false matters just as much as that passthrough: since range
      // is a function (not a literal array), uPlot's default would treat
      // the scale as auto-ranging, and every setData() call (e.g. changing
      // smoothing) would re-derive [min, max] from the new data's own
      // extent - always [20, 20000], the full grid - discarding whatever
      // zoom/pan was active. With auto: false, setData instead re-applies
      // the scale's own current min/max through range() (the initMin/
      // initMax path above), so the zoom survives.
      x: {
        time: false,
        distr: 3,
        auto: false,
        range: (_u, initMin, initMax) => (initMin == null ? xRange.value : [initMin, initMax]),
      },
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
