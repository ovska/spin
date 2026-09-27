import type { SmoothingMode } from '../core/smoothing';
import { smoothing, xRange, ySpanDb, zoomPreset, ZOOM_RANGES, type YSpanDb, type ZoomPreset } from '../state/settings';
import { CycleButton, type CycleOption } from './CycleButton';
import { SmoothIcon, RangeIcon, SpanIcon } from './icons';

const SMOOTHING_OPTIONS: CycleOption<SmoothingMode>[] = [
  { value: 'none', label: 'None' },
  { value: '1/12', label: '1/12' },
  { value: '1/6', label: '1/6' },
  { value: '1/3', label: '1/3' },
  { value: 'erb', label: 'ERB' },
];

const ZOOM_OPTIONS: CycleOption<ZoomPreset>[] = [
  { value: 'full', label: 'Full' },
  { value: 'bass', label: 'Bass' },
  { value: 'crossover', label: 'Xover' },
  { value: 'treble', label: 'Treble' },
];

const YSPAN_OPTIONS: CycleOption<YSpanDb>[] = [
  { value: 5, label: '±5' },
  { value: 10, label: '±10' },
  { value: 25, label: '±25' },
];

export function Controls() {
  return (
    <div class="controls">
      <div class="controls__cycle-row">
        <CycleButton
          icon={<SmoothIcon />}
          groupLabel="Smooth"
          options={SMOOTHING_OPTIONS}
          value={smoothing.value}
          onChange={(v) => {
            smoothing.value = v;
          }}
        />
        <CycleButton
          icon={<RangeIcon />}
          groupLabel="Range"
          options={ZOOM_OPTIONS}
          value={zoomPreset.value}
          onChange={(v) => {
            zoomPreset.value = v;
            xRange.value = ZOOM_RANGES[v];
          }}
        />
        <CycleButton
          icon={<SpanIcon />}
          groupLabel="Span"
          options={YSPAN_OPTIONS}
          value={ySpanDb.value}
          onChange={(v) => {
            ySpanDb.value = v;
          }}
        />
      </div>
    </div>
  );
}
