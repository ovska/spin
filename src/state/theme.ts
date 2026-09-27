import { signal } from '@preact/signals';

export type ThemeMode = 'auto' | 'light' | 'dark';

export const themeMode = signal<ThemeMode>('auto');

export function applyTheme(mode: ThemeMode): void {
  if (mode === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = mode;
}

export function cycleTheme(): void {
  const order: ThemeMode[] = ['auto', 'light', 'dark'];
  const next = order[(order.indexOf(themeMode.value) + 1) % order.length];
  themeMode.value = next;
}
