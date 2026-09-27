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
  /** True when the live value has drifted away from every option (e.g. the
   * user dragged/pinched the x-range instead of tapping a preset) - shows
   * "Custom" and hides the indicator instead of a stale-looking preset
   * label, since none of them are actually true anymore. Tapping still
   * cycles from wherever `value` last matched a preset. */
  custom?: boolean;
}

/** A single button that cycles through a small fixed set of options on tap
 * (e.g. smoothing, frequency range, dB span), instead of a row of one
 * button per option - the bottom edge lights up the segment of the cycle
 * the current value sits at, so the position is visible without spelling
 * out "2/4" in text. */
export function CycleButton<T>({ icon, groupLabel, options, value, onChange, custom }: Props<T>) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const current = options[index];
  const fill = current.fill ?? { left: index / options.length, width: 1 / options.length };
  const displayLabel = custom ? 'Custom' : current.label;
  // Reserve width for the longest possible label up front (in `ch`, i.e.
  // roughly one digit-width per character) so cycling through options of
  // different lengths ("Range: Full" -> "Range: Crossover"), or into/out of
  // "Custom", never resizes the button.
  const widestChars = Math.max(...options.map((o) => `${groupLabel}: ${o.label}`.length), `${groupLabel}: Custom`.length);

  function cycle(): void {
    onChange(options[(index + 1) % options.length].value);
  }

  return (
    <button
      type="button"
      class="cycle-btn"
      onClick={cycle}
      aria-label={
        custom
          ? `${groupLabel}: custom (tap to reset to ${options[0].label})`
          : `${groupLabel}: ${current.label} (tap to change, ${index + 1} of ${options.length})`
      }
    >
      {icon}
      <span class="cycle-btn__label" style={{ minWidth: `${widestChars}ch` }}>
        {groupLabel}: {displayLabel}
      </span>
      <span class="cycle-btn__track">
        {!custom && <span class="cycle-btn__fill" style={{ left: `${fill.left * 100}%`, width: `${fill.width * 100}%` }} />}
      </span>
    </button>
  );
}
