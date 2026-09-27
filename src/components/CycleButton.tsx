import type { ComponentChildren } from 'preact';

export interface CycleOption<T> {
  value: T;
  label: string;
  /** Where this option's segment sits on the bottom indicator, as [0, 1]
   * fractions of the track - lets the indicator mean something (e.g. the
   * frequency range button lighting up roughly the part of the spectrum
   * each preset covers) instead of just "position in the list". Options
   * without one fall back to an equal-width slot at their index. */
  fill?: { left: number; width: number };
}

interface Props<T> {
  icon?: ComponentChildren;
  groupLabel: string;
  options: CycleOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** A single button that cycles through a small fixed set of options on tap
 * (e.g. smoothing, frequency range, dB span), instead of a row of one
 * button per option - the bottom edge lights up the segment of the cycle
 * the current value sits at, so the position is visible without spelling
 * out "2/4" in text. */
export function CycleButton<T>({ icon, groupLabel, options, value, onChange }: Props<T>) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const current = options[index];
  const fill = current.fill ?? { left: index / options.length, width: 1 / options.length };
  // Reserve width for the longest possible label up front (in `ch`, i.e.
  // roughly one digit-width per character) so cycling through options of
  // different lengths ("Range: Full" -> "Range: Crossover") never resizes
  // the button.
  const widestChars = Math.max(...options.map((o) => `${groupLabel}: ${o.label}`.length));

  function cycle(): void {
    onChange(options[(index + 1) % options.length].value);
  }

  return (
    <button
      type="button"
      class="cycle-btn"
      onClick={cycle}
      aria-label={`${groupLabel}: ${current.label} (tap to change, ${index + 1} of ${options.length})`}
    >
      {icon}
      <span class="cycle-btn__label" style={{ minWidth: `${widestChars}ch` }}>
        {groupLabel}: {current.label}
      </span>
      <span class="cycle-btn__track">
        <span class="cycle-btn__fill" style={{ left: `${fill.left * 100}%`, width: `${fill.width * 100}%` }} />
      </span>
    </button>
  );
}
