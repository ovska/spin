import type { SmoothingMode } from '../core/smoothing';
import { smoothing, xRange, ySpanDb, zoomPreset, ZOOM_RANGES, type YSpanDb, type ZoomPreset } from '../state/settings';

const SMOOTHING_OPTIONS: { value: SmoothingMode; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: '1/12', label: '1/12' },
  { value: '1/6', label: '1/6' },
  { value: '1/3', label: '1/3' },
  { value: 'erb', label: 'ERB' },
];

const ZOOM_OPTIONS: { value: ZoomPreset; label: string }[] = [
  { value: 'full', label: 'Full' },
  { value: 'bass', label: 'Bass' },
  { value: 'crossover', label: 'Crossover' },
  { value: 'treble', label: 'Treble' },
];

const YSPAN_OPTIONS: YSpanDb[] = [5, 10, 25];

export function Controls() {
  return (
    <div class="controls">
      <div class="controls__group" role="group" aria-label="Smoothing">
        {SMOOTHING_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            class={`chip-btn${smoothing.value === opt.value ? ' chip-btn--active' : ''}`}
            onClick={() => {
              smoothing.value = opt.value;
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div class="controls__group" role="group" aria-label="Zoom">
        {ZOOM_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            class={`chip-btn${zoomPreset.value === opt.value ? ' chip-btn--active' : ''}`}
            onClick={() => {
              zoomPreset.value = opt.value;
              xRange.value = ZOOM_RANGES[opt.value];
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div class="controls__group" role="group" aria-label="Y span">
        {YSPAN_OPTIONS.map((span) => (
          <button
            key={span}
            type="button"
            class={`chip-btn${ySpanDb.value === span ? ' chip-btn--active' : ''}`}
            onClick={() => {
              ySpanDb.value = span;
            }}
          >
            ±{span}
          </button>
        ))}
      </div>
    </div>
  );
}
