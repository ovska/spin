import { settingsOpen } from '../state/ui';
import { geometry, manualWindow, showPoints, sweetSpotMode } from '../state/sweetspot';
import type { ListenerGeometry } from '../core/sweetspot';

function numberField(label: string, value: number, onChange: (v: number) => void, step = 1) {
  return (
    <label class="field">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))}
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
            {numberField('Listening distance (cm)', g.distanceCm, (v) => updateGeometry({ distanceCm: v }))}
            {numberField('Tweeter height (cm)', g.tweeterHeightCm, (v) => updateGeometry({ tweeterHeightCm: v }))}
            {numberField('Ear height (cm)', g.earHeightCm, (v) => updateGeometry({ earHeightCm: v }))}
            {numberField('Head movement ± horizontal (cm)', g.headMoveHCm, (v) => updateGeometry({ headMoveHCm: v }))}
            {numberField('Head movement ± vertical (cm)', g.headMoveVCm, (v) => updateGeometry({ headMoveVCm: v }))}
            {numberField('Toe-in (deg)', g.toeInDeg, (v) => updateGeometry({ toeInDeg: v }), 0.5)}
          </div>
        ) : (
          <div class="field-grid">
            {numberField('Horizontal min (deg)', m.hMin, (v) => (manualWindow.value = { ...m, hMin: v }))}
            {numberField('Horizontal max (deg)', m.hMax, (v) => (manualWindow.value = { ...m, hMax: v }))}
            {numberField('Vertical min (deg)', m.vMin, (v) => (manualWindow.value = { ...m, vMin: v }))}
            {numberField('Vertical max (deg)', m.vMax, (v) => (manualWindow.value = { ...m, vMax: v }))}
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
