import { computed, signal } from '@preact/signals';
import { geometryToWindow, type AngleWindow, type ListenerGeometry } from '../core/sweetspot';

export type SweetSpotMode = 'geometry' | 'manual';

export const sweetSpotMode = signal<SweetSpotMode>('geometry');

export const geometry = signal<ListenerGeometry>({
  distanceCm: 250,
  tweeterHeightCm: 100,
  earHeightCm: 100,
  headMoveHCm: 15,
  headMoveVCm: 8,
  toeInDeg: 0,
});

export const manualWindow = signal<AngleWindow>({ hMin: -10, hMax: 10, vMin: -10, vMax: 10 });

export const showPoints = signal(false);

export const activeWindow = computed<AngleWindow>(() =>
  sweetSpotMode.value === 'manual' ? manualWindow.value : geometryToWindow(geometry.value),
);
