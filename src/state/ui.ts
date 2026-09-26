import { signal } from '@preact/signals';

export type ViewId = 'sweetspot' | 'cea2034' | 'inroom' | 'offaxis';

export const VIEW_LABELS: Record<ViewId, string> = {
  sweetspot: 'Sweet spot',
  cea2034: 'CEA2034',
  inroom: 'In-room',
  offaxis: 'Off-axis',
};

export const ALL_VIEWS: ViewId[] = ['sweetspot', 'cea2034', 'inroom', 'offaxis'];

export const currentTab = signal<ViewId>('cea2034');

/** Cursor frequency in Hz, or null when no cursor has been placed yet. */
export const cursorFreqHz = signal<number | null>(null);

export const blindMode = signal(false);

export const pickerOpen = signal(false);
export const settingsOpen = signal(false);
export const aboutOpen = signal(false);
