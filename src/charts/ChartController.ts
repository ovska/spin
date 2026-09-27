import uPlot from 'uplot';
import type { SpeakerData } from '../core/types';
import type { SmoothingMode } from '../core/smoothing';
import type { YSpanDb } from '../state/settings';

/** Base for a per-view chart controller: owns one uPlot instance per
 * speaker, stacked in the same container, visibility toggled rather than
 * recreated - so flipping the active speaker is just a display swap. */
export abstract class ChartController {
  protected plots = new Map<string, uPlot>();
  protected wrappers = new Map<string, HTMLElement>();
  protected rawData = new Map<string, SpeakerData>();
  protected container: HTMLElement;
  protected width: number;
  protected height: number;

  constructor(container: HTMLElement) {
    this.container = container;
    const rect = container.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
  }

  protected abstract buildOptions(width: number, height: number): uPlot.Options;
  protected abstract buildData(data: SpeakerData, smoothing: SmoothingMode): uPlot.AlignedData;
  abstract applyYSpan(spanDb: YSpanDb): void;

  ensureSpeaker(id: string, data: SpeakerData, smoothing: SmoothingMode): void {
    if (this.plots.has(id)) return;
    this.rawData.set(id, data);
    const el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.inset = '0';
    el.style.display = 'none';
    this.container.appendChild(el);
    const opts = this.buildOptions(this.width, this.height);
    const plotData = this.buildData(data, smoothing);
    const u = new uPlot(opts, plotData, el);
    this.plots.set(id, u);
    this.wrappers.set(id, el);
  }

  pruneTo(ids: Set<string>): void {
    for (const [id, u] of this.plots) {
      if (!ids.has(id)) {
        u.destroy();
        this.plots.delete(id);
        this.wrappers.get(id)?.remove();
        this.wrappers.delete(id);
        this.rawData.delete(id);
      }
    }
  }

  setVisible(id: string | null): void {
    for (const [sid, el] of this.wrappers) {
      el.style.display = sid === id ? 'block' : 'none';
    }
  }

  setXRange(range: [number, number]): void {
    for (const u of this.plots.values()) u.setScale('x', { min: range[0], max: range[1] });
  }

  applySmoothing(smoothing: SmoothingMode): void {
    for (const [id, u] of this.plots) {
      const data = this.rawData.get(id);
      if (data) u.setData(this.buildData(data, smoothing));
    }
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    for (const u of this.plots.values()) u.setSize({ width: this.width, height: this.height });
  }

  getPlot(id: string | null): uPlot | null {
    return id ? (this.plots.get(id) ?? null) : null;
  }

  protected forEachPlot(fn: (u: uPlot) => void): void {
    for (const u of this.plots.values()) fn(u);
  }

  protected getAllRawData(): [string, SpeakerData][] {
    return Array.from(this.rawData.entries());
  }

  dispose(): void {
    for (const u of this.plots.values()) u.destroy();
    // u.destroy() only removes uPlot's own root; our wrapper div (created in
    // ensureSpeaker to hold it, and toggled by setVisible) is ours to detach.
    for (const el of this.wrappers.values()) el.remove();
    this.plots.clear();
    this.wrappers.clear();
    this.rawData.clear();
  }
}
