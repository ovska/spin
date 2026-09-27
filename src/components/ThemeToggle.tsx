import { themeMode, cycleTheme } from '../state/theme';

const LABEL = { auto: 'Auto', light: 'Light', dark: 'Dark' } as const;

export function ThemeToggle() {
  const mode = themeMode.value;
  return (
    <button
      type="button"
      class="app-header__theme"
      aria-label={`Theme: ${LABEL[mode]} (tap to change)`}
      onClick={cycleTheme}
    >
      {LABEL[mode]}
    </button>
  );
}
