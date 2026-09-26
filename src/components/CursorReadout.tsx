import { getController } from '../charts/registry';
import { activeSpeakerId, peeking, referenceSpeakerId } from '../state/speakers';
import { currentTab, cursorFreqHz } from '../state/ui';

function formatFreq(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(2)} kHz` : `${hz.toFixed(0)} Hz`;
}

export function CursorReadout() {
  const view = currentTab.value;
  const freq = cursorFreqHz.value;
  const speakerId = peeking.value && referenceSpeakerId.value ? referenceSpeakerId.value : activeSpeakerId.value;

  if (freq == null) {
    return <div class="cursor-readout cursor-readout--empty">Tap the plot to read values at a frequency</div>;
  }

  const controller = getController(view);
  const values = controller?.valuesAt(speakerId, freq) ?? null;
  const meta = controller?.seriesMeta() ?? [];

  return (
    <div class="cursor-readout">
      <span class="cursor-readout__freq">{formatFreq(freq)}</span>
      {meta.map((m, i) => (
        <span class="cursor-readout__item" key={m.label}>
          <span class="cursor-readout__swatch" style={{ background: m.color }} />
          <span class="cursor-readout__value">{values?.[i] != null && Number.isFinite(values[i]) ? `${values[i].toFixed(1)} dB` : '–'}</span>
        </span>
      ))}
    </div>
  );
}
