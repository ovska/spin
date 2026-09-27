import uPlot from 'uplot';
import { ChartController } from './ChartController';
import { baseOptions } from './uplotBase';
import { AXIS_COLOR } from './palette';
import { heatmapRgbForValue } from './heatmapPalette';
import { getOffAxisTable, H_ANGLE_MIN, H_ANGLE_MAX, V_ANGLE_MIN, V_ANGLE_MAX, type OffAxisTable } from './offAxisTable';
import { GRID_FMIN, GRID_FMAX } from '../core/grid';
import type { SmoothingMode } from '../core/smoothing';
import type { AngleWindow } from '../core/sweetspot';
import type { SpeakerData } from '../core/types';
import type { YSpanDb } from '../state/settings';
import type { OffAxisPlane } from '../state/offaxis';

export class OffAxisHeatmapController extends ChartController {
  private plane: OffAxisPlane = 'horizontal';
  private selectedAngle = 0;
  private sweetSpotWindow: AngleWindow | null = null;
  private rasters = new Map<string, HTMLCanvasElement>();
  private idByPlot = new Map<uPlot, string>();
  private currentSmoothing: SmoothingMode = 'none';
  // The color scale's [min, max] dB-relative-to-on-axis range - the widest
  // spread found across every selected speaker in the current plane, so
  // quiet speakers don't all render as a single color and comparisons
  // between speakers share one scale. Recomputed whenever the selected set,
  // plane, or smoothing changes (see recomputeRangeAndRedraw).
  private range: [number, number] = [-1, 1];

  private angleRange(): [number, number] {
    return this.plane === 'horizontal' ? [H_ANGLE_MIN, H_ANGLE_MAX] : [V_ANGLE_MIN, V_ANGLE_MAX];
  }

  protected buildOptions(width: number, height: number): uPlot.Options {
    const base = baseOptions(width, height);
    return {
      ...base,
      scales: { ...base.scales, ang: { range: () => this.angleRange() } },
      axes: [
        { ...base.axes![0], size: 0, ticks: { show: false } },
        { ...base.axes![1], scale: 'ang' },
      ],
      series: [{}, { show: false, scale: 'ang' }],
      hooks: { draw: [(u: uPlot) => this.draw(u)] },
    } as uPlot.Options;
  }

  protected buildData(data: SpeakerData, mode: SmoothingMode): uPlot.AlignedData {
    const table = getOffAxisTable(data, mode);
    return [table.freqHz, table.freqHz.map(() => 0)];
  }

  private rowsFor(table: OffAxisTable): OffAxisTable['horizontal' | 'vertical'] {
    return this.plane === 'horizontal' ? table.horizontal : table.vertical;
  }

  /** Widest [min, max] deviation-from-on-axis found across every currently
   * loaded speaker, for the current plane - the shared color scale's range. */
  private computeRange(tables: OffAxisTable[]): [number, number] {
    let min = Infinity;
    let max = -Infinity;
    for (const table of tables) {
      const rows = this.rowsFor(table);
      for (const curve of rows.curves) {
        for (let col = 0; col < curve.length; col++) {
          const v = curve[col] - table.onAxis[col];
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [-1, 1];
    if (min === max) return [min - 1, max + 1];
    return [min, max];
  }

  private rebuildRaster(id: string, table: OffAxisTable): void {
    const rows = this.rowsFor(table);
    const w = table.freqHz.length;
    const h = rows.curves.length;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(w, h);
    const [min, max] = this.range;
    for (let row = 0; row < h; row++) {
      const canvasY = h - 1 - row; // flip: image row 0 (top) = highest angle
      const curve = rows.curves[row];
      for (let col = 0; col < w; col++) {
        const value = curve[col] - table.onAxis[col];
        const [r, g, b] = heatmapRgbForValue(value, min, max);
        const idx = (canvasY * w + col) * 4;
        img.data[idx] = r;
        img.data[idx + 1] = g;
        img.data[idx + 2] = b;
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    this.rasters.set(id, canvas);
  }

  /** Recomputes the shared color range from every loaded speaker's current
   * table (for the current plane/smoothing) and rebuilds every raster with
   * it - called whenever the selected set, plane, or smoothing changes. */
  private recomputeRangeAndRedraw(): void {
    const entries = this.getAllRawData().map(([id, data]) => [id, getOffAxisTable(data, this.currentSmoothing)] as const);
    this.range = this.computeRange(entries.map(([, table]) => table));
    for (const [id, table] of entries) this.rebuildRaster(id, table);
    this.forEachPlot((u) => u.redraw());
  }

  private draw(u: uPlot): void {
    const id = this.idByPlot.get(u);
    if (!id) return;
    const canvas = this.rasters.get(id);
    if (!canvas) return;

    const ctx = u.ctx;
    const x0 = u.valToPos(GRID_FMIN, 'x', true);
    const x1 = u.valToPos(GRID_FMAX, 'x', true);
    const [angMin, angMax] = this.angleRange();
    const y0 = u.valToPos(angMax, 'ang', true);
    const y1 = u.valToPos(angMin, 'ang', true);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, x0, y0, x1 - x0, y1 - y0);

    if (this.sweetSpotWindow) {
      const [wMin, wMax] =
        this.plane === 'horizontal'
          ? [this.sweetSpotWindow.hMin, this.sweetSpotWindow.hMax]
          : [this.sweetSpotWindow.vMin, this.sweetSpotWindow.vMax];
      const wy0 = u.valToPos(wMax, 'ang', true);
      const wy1 = u.valToPos(wMin, 'ang', true);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x0 + 1, wy0, x1 - x0 - 2, wy1 - wy0);
      ctx.setLineDash([]);
    }

    const ySel = u.valToPos(this.selectedAngle, 'ang', true);
    ctx.strokeStyle = AXIS_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, ySel);
    ctx.lineTo(x1, ySel);
    ctx.stroke();
    ctx.restore();
  }

  ensureSpeaker(id: string, data: SpeakerData, smoothing: SmoothingMode): void {
    const wasNew = this.getPlot(id) == null;
    super.ensureSpeaker(id, data, smoothing);
    if (wasNew) {
      const plot = this.getPlot(id);
      if (plot) this.idByPlot.set(plot, id);
      this.recomputeRangeAndRedraw();
    }
  }

  pruneTo(ids: Set<string>): void {
    for (const id of Array.from(this.rasters.keys())) {
      if (!ids.has(id)) this.rasters.delete(id);
    }
    super.pruneTo(ids);
    this.recomputeRangeAndRedraw();
  }

  setPlane(plane: OffAxisPlane): void {
    if (this.plane === plane) return;
    this.plane = plane;
    this.forEachPlot((u) => u.setScale('ang', { min: this.angleRange()[0], max: this.angleRange()[1] }));
    this.recomputeRangeAndRedraw();
  }

  applySmoothing(smoothing: SmoothingMode): void {
    this.currentSmoothing = smoothing;
    super.applySmoothing(smoothing);
    this.recomputeRangeAndRedraw();
  }

  setSelectedAngle(deg: number): void {
    this.selectedAngle = deg;
    this.forEachPlot((u) => u.redraw());
  }

  setSweetSpotWindow(window: AngleWindow | null): void {
    this.sweetSpotWindow = window;
    this.forEachPlot((u) => u.redraw());
  }

  /** Angle at a given fraction (0 = top = max angle, 1 = bottom = min
   * angle) of the plot's height - used when the user taps the heatmap to
   * pick both frequency and angle. */
  angleAtFraction(yFraction: number): number {
    const [angMin, angMax] = this.angleRange();
    return angMax - yFraction * (angMax - angMin);
  }

  applyYSpan(_spanDb: YSpanDb): void {
    // Heatmap's y axis is angle, not dB - y-span doesn't apply.
  }
}
