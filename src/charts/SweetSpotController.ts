import uPlot from 'uplot';
import { ChartController } from './ChartController';
import { baseOptions } from './uplotBase';
import { CURVE_COLOR } from './palette';
import { smoothPowerDomain, type SmoothingMode } from '../core/smoothing';
import { computeSweetSpot, type AngleWindow, type SweetSpotResult } from '../core/sweetspot';
import type { Plane } from '../core/cea2034';
import type { SpeakerData } from '../core/types';
import type { YSpanDb } from '../state/settings';

interface SmoothedPlanes {
  mode: SmoothingMode;
  h: Plane;
  v: Plane;
  onAxis: number[];
}

function smoothPlane(plane: Plane | undefined, freq: number[], mode: SmoothingMode): Plane {
  const out: Plane = {};
  for (const [label, curve] of Object.entries(plane ?? {})) {
    out[label] = smoothPowerDomain(freq, curve, mode);
  }
  return out;
}

const LIGHT_BAND = 'rgba(31,119,180,0.16)';
const DARK_BAND = 'rgba(31,119,180,0.32)';
const POINT_STROKE = 'rgba(31,119,180,0.15)';

export class SweetSpotController extends ChartController {
  private spanDb: YSpanDb = 10;
  private window: AngleWindow = { hMin: 0, hMax: 0, vMin: 0, vMax: 0 };
  private showPoints = false;
  private currentSmoothing: SmoothingMode = 'none';
  private smoothedCache = new Map<string, SmoothedPlanes>();
  private resultById = new Map<string, SweetSpotResult>();
  private idByPlot = new Map<uPlot, string>();

  protected buildOptions(width: number, height: number): uPlot.Options {
    const base = baseOptions(width, height);
    return {
      ...base,
      scales: { ...base.scales, db: { range: () => [-this.spanDb, this.spanDb] } },
      axes: [base.axes![0], { ...base.axes![1], scale: 'db' }],
      series: [{}, { label: 'Average', stroke: CURVE_COLOR.onAxis, width: 1.5, scale: 'db', points: { show: false } }],
      hooks: {
        // Runs before axes/series are painted, so the bands sit behind the
        // average line rather than over it.
        drawClear: [
          (u: uPlot) => {
            const result = this.resultFor(u);
            if (result) this.drawBands(u, result);
          },
        ],
        draw: [
          (u: uPlot) => {
            if (!this.showPoints) return;
            const result = this.resultFor(u);
            if (result) this.drawPoints(u, result);
          },
        ],
      },
    } as uPlot.Options;
  }

  private resultFor(u: uPlot): SweetSpotResult | undefined {
    const id = this.idByPlot.get(u);
    return id ? this.resultById.get(id) : undefined;
  }

  private fillBetween(u: uPlot, xs: number[], top: number[], bottom: number[], color: string): void {
    const ctx = u.ctx;
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < xs.length; i++) {
      const px = u.valToPos(xs[i], 'x', true);
      const py = u.valToPos(top[i], 'db', true);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    for (let i = xs.length - 1; i >= 0; i--) {
      const px = u.valToPos(xs[i], 'x', true);
      const py = u.valToPos(bottom[i], 'db', true);
      ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawBands(u: uPlot, result: SweetSpotResult): void {
    const xs = u.data[0] as number[];
    this.fillBetween(u, xs, result.max, result.min, LIGHT_BAND);
    this.fillBetween(u, xs, result.p75, result.p25, DARK_BAND);
  }

  private drawPoints(u: uPlot, result: SweetSpotResult): void {
    const ctx = u.ctx;
    const xs = u.data[0] as number[];
    ctx.save();
    ctx.strokeStyle = POINT_STROKE;
    ctx.lineWidth = 1;
    for (const sample of result.samples) {
      ctx.beginPath();
      for (let i = 0; i < xs.length; i++) {
        const px = u.valToPos(xs[i], 'x', true);
        const py = u.valToPos(sample.curve[i], 'db', true);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  private getSmoothed(id: string, data: SpeakerData, mode: SmoothingMode): SmoothedPlanes {
    const cached = this.smoothedCache.get(id);
    if (cached && cached.mode === mode) return cached;
    const freq = data.cea2034?.freqHz ?? [];
    const computed: SmoothedPlanes = {
      mode,
      h: smoothPlane(data.horizontal, freq, mode),
      v: smoothPlane(data.vertical, freq, mode),
      onAxis: smoothPowerDomain(freq, data.cea2034?.onAxis ?? [], mode),
    };
    this.smoothedCache.set(id, computed);
    return computed;
  }

  protected buildData(data: SpeakerData, mode: SmoothingMode): uPlot.AlignedData {
    const freq = data.cea2034?.freqHz ?? [];
    const { h, v, onAxis } = this.getSmoothed(data.id, data, mode);
    const result = computeSweetSpot(h, v, onAxis, freq.length, this.window);
    this.resultById.set(data.id, result);
    return [freq, result.average];
  }

  ensureSpeaker(id: string, data: SpeakerData, smoothing: SmoothingMode): void {
    const isNew = this.getPlot(id) == null;
    super.ensureSpeaker(id, data, smoothing);
    if (isNew) {
      const plot = this.getPlot(id);
      if (plot) this.idByPlot.set(plot, id);
    }
  }

  pruneTo(ids: Set<string>): void {
    for (const id of Array.from(this.smoothedCache.keys())) {
      if (!ids.has(id)) {
        this.smoothedCache.delete(id);
        this.resultById.delete(id);
      }
    }
    super.pruneTo(ids);
  }

  setWindow(window: AngleWindow): void {
    this.window = window;
    this.refreshAll();
  }

  setShowPoints(show: boolean): void {
    this.showPoints = show;
    this.forEachPlot((u) => u.redraw());
  }

  private refreshAll(): void {
    for (const [id, data] of this.getAllRawData()) {
      const plot = this.getPlot(id);
      if (plot) plot.setData(this.buildData(data, this.currentSmoothing));
    }
  }

  applySmoothing(smoothing: SmoothingMode): void {
    this.currentSmoothing = smoothing;
    super.applySmoothing(smoothing);
  }

  applyYSpan(spanDb: YSpanDb): void {
    this.spanDb = spanDb;
    this.forEachPlot((u) => u.setScale('db', { min: -spanDb, max: spanDb }));
  }

  /** Average, min, max, 25th and 75th percentile at a frequency - for the
   * cursor readout, which knows this view's specific 5-number layout. */
  valuesAt(id: string | null, freqHz: number): number[] | null {
    if (!id) return null;
    const result = this.resultById.get(id);
    const u = this.getPlot(id);
    if (!result || !u) return null;
    const xs = u.data[0] as number[];
    let lo = 0;
    let hi = xs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] < freqHz) lo = mid + 1;
      else hi = mid;
    }
    return [result.average[lo], result.min[lo], result.max[lo], result.p25[lo], result.p75[lo]];
  }

  seriesMeta(): { label: string; color: string }[] {
    return [{ label: 'Average', color: CURVE_COLOR.onAxis }];
  }
}
