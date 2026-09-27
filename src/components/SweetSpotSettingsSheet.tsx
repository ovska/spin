import { useEffect, useRef, useState } from 'preact/hooks';
import { settingsOpen } from '../state/ui';
import { geometry, manualWindow, showPoints, sweetSpotMode } from '../state/sweetspot';
import type { ListenerGeometry } from '../core/sweetspot';

interface NumberFieldProps {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  step?: number;
}

/** A number input that only parses/commits its value on blur, not on every
 * keystroke: while editing, the field is driven by its own local text, not
 * by re-deriving from the committed number - otherwise typing a lone "-"
 * (to start a negative number) immediately round-trips through
 * Number("-") === 0, which re-renders the input back to "0" and erases the
 * "-" before a second character can ever be typed. It also means the
 * expensive part (recomputing the sweet spot window and redrawing every
 * loaded speaker) only happens once per edit instead of on every
 * keystroke - the sheet covers the chart while open, so there's nothing to
 * see from the intermediate redraws anyway, just lag. */
function NumberField({ label, value, onCommit, step = 1 }: NumberFieldProps) {
  const [text, setText] = useState(String(value));
  const editing = useRef(false);

  useEffect(() => {
    if (!editing.current) setText(String(value));
  }, [value]);

  function commit(): void {
    editing.current = false;
    const n = Number(text);
    if (Number.isFinite(n)) {
      onCommit(n);
      setText(String(n));
    } else {
      setText(String(value));
    }
  }

  return (
    <label class="field">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={text}
        onFocus={() => {
          editing.current = true;
        }}
        onInput={(e) => setText((e.target as HTMLInputElement).value)}
        onBlur={commit}
      />
    </label>
  );
}

function updateGeometry(patch: Partial<ListenerGeometry>): void {
  geometry.value = { ...geometry.value, ...patch };
}

export function SweetSpotSettingsSheet() {
  if (!settingsOpen.value) return null;

  function close(): void {
    settingsOpen.value = false;
  }

  const g = geometry.value;
  const m = manualWindow.value;

  return (
    <div class="sheet-backdrop" onClick={close}>
      <div class="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Sweet spot</h2>

        <div class="controls__group" role="group" aria-label="Sweet spot input mode">
          <button
            type="button"
            class={`chip-btn${sweetSpotMode.value === 'geometry' ? ' chip-btn--active' : ''}`}
            onClick={() => {
              sweetSpotMode.value = 'geometry';
            }}
          >
            Listening geometry
          </button>
          <button
            type="button"
            class={`chip-btn${sweetSpotMode.value === 'manual' ? ' chip-btn--active' : ''}`}
            onClick={() => {
              sweetSpotMode.value = 'manual';
            }}
          >
            Manual angles
          </button>
        </div>

        {sweetSpotMode.value === 'geometry' ? (
          <div class="field-grid">
            <NumberField label="Listening distance (cm)" value={g.distanceCm} onCommit={(v) => updateGeometry({ distanceCm: v })} />
            <NumberField label="Tweeter height (cm)" value={g.tweeterHeightCm} onCommit={(v) => updateGeometry({ tweeterHeightCm: v })} />
            <NumberField label="Ear height (cm)" value={g.earHeightCm} onCommit={(v) => updateGeometry({ earHeightCm: v })} />
            <NumberField
              label="Head movement ± horizontal (cm)"
              value={g.headMoveHCm}
              onCommit={(v) => updateGeometry({ headMoveHCm: v })}
            />
            <NumberField
              label="Head movement ± vertical (cm)"
              value={g.headMoveVCm}
              onCommit={(v) => updateGeometry({ headMoveVCm: v })}
            />
            <NumberField label="Toe-in (deg)" value={g.toeInDeg} onCommit={(v) => updateGeometry({ toeInDeg: v })} step={0.5} />
          </div>
        ) : (
          <div class="field-grid">
            <NumberField label="Horizontal min (deg)" value={m.hMin} onCommit={(v) => (manualWindow.value = { ...m, hMin: v })} />
            <NumberField label="Horizontal max (deg)" value={m.hMax} onCommit={(v) => (manualWindow.value = { ...m, hMax: v })} />
            <NumberField label="Vertical min (deg)" value={m.vMin} onCommit={(v) => (manualWindow.value = { ...m, vMin: v })} />
            <NumberField label="Vertical max (deg)" value={m.vMax} onCommit={(v) => (manualWindow.value = { ...m, vMax: v })} />
          </div>
        )}

        <label class="field field--row">
          <span>Points</span>
          <input
            type="checkbox"
            checked={showPoints.value}
            onChange={(e) => {
              showPoints.value = (e.target as HTMLInputElement).checked;
            }}
          />
        </label>

        <p class="sheet-note">Off-plane points estimated from H/V planes.</p>

        <button type="button" class="sheet-close" onClick={close}>
          Close
        </button>
      </div>
    </div>
  );
}
