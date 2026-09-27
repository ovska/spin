import uPlot from 'uplot';
import { ChartController } from './ChartController';
import { CURVE_COLOR, AXIS_COLOR, GRID_COLOR } from './palette';
import type { SmoothingMode } from '../core/smoothing';
import type { SpeakerData } from '../core/types';
import type { YSpanDb } from '../state/settings';

/** Step and impulse aren't frequency-domain views: no smoothing, zoom
 * preset, or y-span control applies (they're precomputed once, at build
 * time, from the unsmoothed on-axis curve), and the x axis is linear time
 * in ms rather than the shared log-frequency scale, so this doesn't
 * participate in the cross-view zoom/pan sync either. */
export class StepImpulseController extends ChartController {
  protected buildOptions(width: number, height: number): uPlot.Options {
    return {
      width,
      height,
      padding: [8, 8, 0, 0],
      legend: { show: false },
      cursor: { show: true, x: true, y: false, drag: { setScale: false, x: false, y: false }, points: { show: false } },
      scales: {
        x: { time: false, range: [0, 20] },
        impulse: {},
        step: {},
      },
      axes: [
        { stroke: AXIS_COLOR, grid: { stroke: GRID_COLOR, width: 1 }, ticks: { stroke: AXIS_COLOR } },
        { stroke: AXIS_COLOR, grid: { stroke: GRID_COLOR, width: 1 }, ticks: { stroke: AXIS_COLOR }, scale: 'step' },
        { stroke: AXIS_COLOR, ticks: { stroke: AXIS_COLOR }, scale: 'impulse', side: 1, grid: { show: false } },
      ],
      series: [
        {},
        { label: 'Step', stroke: CURVE_COLOR.estimatedInRoom, width: 1.5, scale: 'step', points: { show: false } },
        { label: 'Impulse', stroke: CURVE_COLOR.earlyReflections, width: 1, scale: 'impulse', points: { show: false } },
      ],
    } as uPlot.Options;
  }

  protected buildData(data: SpeakerData): uPlot.AlignedData {
    const si = data.stepImpulse;
    return [si?.timeMs ?? [], si?.step ?? [], si?.impulse ?? []];
  }

  applyYSpan(_spanDb: YSpanDb): void {
    // Not applicable: amplitude here isn't dB.
  }

  applySmoothing(_smoothing: SmoothingMode): void {
    // Not applicable: precomputed at build time from the unsmoothed curve.
  }

  seriesMeta(): { label: string; color: string }[] {
    return [
      { label: 'Step', color: CURVE_COLOR.estimatedInRoom },
      { label: 'Impulse', color: CURVE_COLOR.earlyReflections },
    ];
  }
}
