import uPlot from 'uplot';
import { ChartController } from './ChartController';
import { baseOptions } from './uplotBase';
import { CURVE_COLOR } from './palette';
import { smoothPowerDomain, type SmoothingMode } from '../core/smoothing';
import type { SpeakerData } from '../core/types';
import type { YSpanDb } from '../state/settings';

export class InRoomController extends ChartController {
  private spanDb: YSpanDb = 10;

  protected buildOptions(width: number, height: number): uPlot.Options {
    const base = baseOptions(width, height);
    return {
      ...base,
      scales: {
        ...base.scales,
        db: { range: () => [-this.spanDb, this.spanDb] },
      },
      axes: [base.axes![0], { ...base.axes![1], scale: 'db' }],
      series: [
        {},
        {
          label: 'Estimated In-Room Response',
          stroke: CURVE_COLOR.estimatedInRoom,
          width: 1.5,
          scale: 'db',
          points: { show: false },
        },
      ],
    } as uPlot.Options;
  }

  protected buildData(data: SpeakerData, mode: SmoothingMode): uPlot.AlignedData {
    const freq = data.cea2034?.freqHz ?? [];
    const pir = smoothPowerDomain(freq, data.cea2034?.estimatedInRoom ?? [], mode);
    return [freq, pir];
  }

  applyYSpan(spanDb: YSpanDb): void {
    this.spanDb = spanDb;
    this.forEachPlot((u) => u.setScale('db', { min: -spanDb, max: spanDb }));
  }
}
