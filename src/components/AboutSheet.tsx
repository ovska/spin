import { aboutOpen } from '../state/ui';
import { speakerIndex } from '../state/speakers';

export function AboutSheet() {
  if (!aboutOpen.value) return null;

  function close(): void {
    aboutOpen.value = false;
  }

  return (
    <div class="sheet-backdrop" onClick={close}>
      <div class="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>About</h2>
        <p>
          Spin is a personal viewer for anechoic loudspeaker measurements. Measurement data (
          {speakerIndex.value.map((s) => s.name).join(', ') || 'KEF R3, Genelec 8030C, Neumann KH 120 II'}) is
          sourced from <a href="https://www.audiosciencereview.com/" target="_blank" rel="noreferrer">Audio Science Review</a>{' '}
          via the <a href="https://github.com/pierreaubert/spinorama" target="_blank" rel="noreferrer">spinorama</a> project,
          and is licensed CC BY-NC-SA 4.0.
        </p>
        <button type="button" class="sheet-close" onClick={close}>
          Close
        </button>
      </div>
    </div>
  );
}
