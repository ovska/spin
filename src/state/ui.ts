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

export const pickerOpen = signal(false);
export const settingsOpen = signal(false);
export const aboutOpen = signal(false);
