import { signal } from '@preact/signals';

export type ViewId = 'cea2034' | 'inroom';

export const VIEW_LABELS: Record<ViewId, string> = {
  cea2034: 'CEA2034',
  inroom: 'In-room',
};

export const ALL_VIEWS: ViewId[] = ['cea2034', 'inroom'];

export const currentTab = signal<ViewId>('cea2034');

/** Cursor frequency in Hz, or null when no cursor has been placed yet. */
export const cursorFreqHz = signal<number | null>(null);

export const blindMode = signal(false);

export const pickerOpen = signal(false);
export const settingsOpen = signal(false);
export const aboutOpen = signal(false);
