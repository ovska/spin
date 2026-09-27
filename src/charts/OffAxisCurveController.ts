import uPlot from 'uplot';
import { ChartController } from './ChartController';
import { baseOptions } from './uplotBase';
import { CURVE_COLOR } from './palette';
import { getOffAxisTable, rowForAngle } from './offAxisTable';
import type { SmoothingMode } from '../core/smoothing';
import type { SpeakerData } from '../core/types';
import type { YSpanDb } from '../state/settings';
import type { OffAxisPlane } from '../state/offaxis';

/** The scrubbed curve at the selected angle, plus the on-axis curve faintly
 * for reference. Angle changes just re-slice the precomputed per-degree
 * table (offAxisTable.ts), not a fresh PCHIP solve, to stay at 60fps while
 * dragging the slider. */
export class OffAxisCurveController extends ChartController {
  private spanDb: YSpanDb = 10;
  private plane: OffAxisPlane = 'horizontal';
  private angle = 0;
  private currentSmoothing: SmoothingMode = 'none';

  protected buildOptions(width: number, height: number): uPlot.Options {
    const base = baseOptions(width, height);
    return {
      ...base,
      scales: { ...base.scales, db: { range: () => [-this.spanDb, this.spanDb] } },
      axes: [base.axes![0], { ...base.axes![1], scale: 'db' }],
      series: [
        {},
        { label: 'On Axis', stroke: CURVE_COLOR.reference, width: 1, scale: 'db', points: { show: false } },
        { label: 'Selected angle', stroke: CURVE_COLOR.onAxis, width: 1.5, scale: 'db', points: { show: false } },
      ],
    } as uPlot.Options;
  }

  protected buildData(data: SpeakerData, mode: SmoothingMode): uPlot.AlignedData {
    this.currentSmoothing = mode;
    const table = getOffAxisTable(data, mode);
    const rows = this.plane === 'horizontal' ? table.horizontal : table.vertical;
    const selected = rowForAngle(rows, this.angle);
    return [table.freqHz, table.onAxis, selected];
  }

  setPlane(plane: OffAxisPlane): void {
    this.plane = plane;
    this.refreshAll();
  }

  setAngle(deg: number): void {
    this.angle = deg;
    // Fast path: re-slice the precomputed table and patch just the selected
    // series in place, skipping buildData's full-table lookup/smoothing.
    for (const [id, data] of this.getAllRawData()) {
      const plot = this.getPlot(id);
      if (!plot) continue;
      const table = getOffAxisTable(data, this.currentSmoothing);
      const rows = this.plane === 'horizontal' ? table.horizontal : table.vertical;
      plot.setData([table.freqHz, table.onAxis, rowForAngle(rows, deg)]);
    }
  }

  private refreshAll(): void {
    for (const [id, data] of this.getAllRawData()) {
      const plot = this.getPlot(id);
      if (plot) plot.setData(this.buildData(data, this.currentSmoothing));
    }
  }

  applyYSpan(spanDb: YSpanDb): void {
    this.spanDb = spanDb;
    this.forEachPlot((u) => u.setScale('db', { min: -spanDb, max: spanDb }));
  }
}
