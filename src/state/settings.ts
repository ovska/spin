import { signal } from '@preact/signals';
import type { SmoothingMode } from '../core/smoothing';

export type ZoomPreset = 'full' | 'low' | 'bass' | 'crossover' | 'treble' | 'high';
export type YSpanDb = 5 | 10 | 25;

export const ZOOM_RANGES: Record<ZoomPreset, [number, number]> = {
  full: [20, 20000],
  low: [20, 1000],
  bass: [20, 500],
  crossover: [500, 5000],
  treble: [2000, 20000],
  high: [1000, 20000],
};

export const smoothing = signal<SmoothingMode>('1/6');
export const zoomPreset = signal<ZoomPreset>('full');
export const ySpanDb = signal<YSpanDb>(10);

/** The actual visible x range, in Hz. Diverges from `zoomPreset`'s range as
 * soon as the user drags or pinch-zooms; a preset tap snaps back to it. */
export const xRange = signal<[number, number]>(ZOOM_RANGES.full);

