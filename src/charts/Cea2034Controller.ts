import uPlot from 'uplot';
import { ChartController } from './ChartController';
import { baseOptions } from './uplotBase';
import { CURVE_COLOR } from './palette';
import { smoothPowerDomain, type SmoothingMode } from '../core/smoothing';
import type { SpeakerData } from '../core/types';
import type { YSpanDb } from '../state/settings';

export const CEA2034_SERIES = [
  { key: 'onAxis', label: 'On Axis', color: CURVE_COLOR.onAxis, scale: 'db' },
  { key: 'listeningWindow', label: 'Listening Window', color: CURVE_COLOR.listeningWindow, scale: 'db' },
  { key: 'earlyReflections', label: 'Early Reflections', color: CURVE_COLOR.earlyReflections, scale: 'db' },
  { key: 'soundPower', label: 'Sound Power', color: CURVE_COLOR.soundPower, scale: 'db' },
  { key: 'soundPowerDi', label: 'Sound Power DI', color: CURVE_COLOR.soundPowerDi, scale: 'di' },
  { key: 'earlyReflectionsDi', label: 'Early Reflections DI', color: CURVE_COLOR.earlyReflectionsDi, scale: 'di' },
] as const;

export class Cea2034Controller extends ChartController {
  private spanDb: YSpanDb = 10;

  protected buildOptions(width: number, height: number): uPlot.Options {
    const base = baseOptions(width, height);
    return {
      ...base,
      scales: {
        ...base.scales,
        db: { range: () => [-this.spanDb, this.spanDb] },
        di: { range: [0, 15] },
      },
      axes: [
        base.axes![0],
        { ...base.axes![1], scale: 'db' },
        { scale: 'di', side: 1, stroke: base.axes?.[1]?.stroke, grid: { show: false } },
      ],
      series: [
        {},
        ...CEA2034_SERIES.map((s) => ({
          label: s.label,
          stroke: s.color,
          width: 1.5,
          scale: s.scale,
          points: { show: false },
        })),
      ],
    } as uPlot.Options;
  }

  protected buildData(data: SpeakerData, mode: SmoothingMode): uPlot.AlignedData {
    const cea = data.cea2034;
    const freq = cea?.freqHz ?? [];
    const onAxis = smoothPowerDomain(freq, cea?.onAxis ?? [], mode);
    const lw = smoothPowerDomain(freq, cea?.listeningWindow ?? [], mode);
    const er = smoothPowerDomain(freq, cea?.earlyReflections ?? [], mode);
    const sp = smoothPowerDomain(freq, cea?.soundPower ?? [], mode);
    const spDi = lw.map((v, i) => v - sp[i]);
    const erDi = lw.map((v, i) => v - er[i]);
    return [freq, onAxis, lw, er, sp, spDi, erDi];
  }

  applyYSpan(spanDb: YSpanDb): void {
    this.spanDb = spanDb;
    this.forEachPlot((u) => u.setScale('db', { min: -spanDb, max: spanDb }));
  }
}
