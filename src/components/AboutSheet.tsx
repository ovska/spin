import { aboutOpen } from '../state/ui';
import { activeSpeakerId, speakerDataCache, speakerIndex } from '../state/speakers';

const URL_RE = /(https?:\/\/[^\s]+)/g;

/** Renders plain text with any bare URLs turned into clickable links -
 * license text is a mix of legal boilerplate (ASR) and a plain sentence
 * with an embedded review link (the Erin's Audio Corner fallback, see
 * scripts/sync-measurements.ts), neither of which is markup. */
function linkify(text: string) {
  // split() with a capturing group returns [text, url, text, url, ...] - odd
  // indices are exactly the matched URLs, so no separate regex.test() call
  // is needed (which would be stateful and buggy here, since URL_RE is /g).
  const parts = text.split(URL_RE);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part} target="_blank" rel="noreferrer">
        {part}
      </a>
    ) : (
      part
    ),
  );
}

export function AboutSheet() {
  if (!aboutOpen.value) return null;

  function close(): void {
    aboutOpen.value = false;
  }

  const origins = [...new Set(speakerIndex.value.map((s) => s.origin))].sort();

  const activeId = activeSpeakerId.value;
  const activeData = activeId ? speakerDataCache.value[activeId] : null;
  const active = activeData && activeData !== 'loading' && activeData !== 'error' ? activeData : null;

  return (
    <div class="sheet-backdrop" onClick={close}>
      <div class="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>About</h2>
        <p>
          Spin is a personal viewer for anechoic loudspeaker measurements, sourced via the{' '}
          <a href="https://github.com/pierreaubert/spinorama" target="_blank" rel="noreferrer">
            spinorama
          </a>{' '}
          project from {origins.length > 0 ? origins.join(' and ') : 'Audio Science Review and Erin’s Audio Corner'}.
        </p>
        <p>
          Audio Science Review measurements are copyrighted by Audio Science Review LLC and licensed CC BY-NC-SA 4.0.
          Erin's Audio Corner doesn't publish a machine-readable license per measurement; those are attributed with a
          link to the original review instead.
        </p>
        {active && (
          <p class="sheet-note">
            Currently viewing <strong>{active.name}</strong> ({active.origin}):
            <br />
            {linkify(active.license || 'No license or attribution text was recorded for this measurement.')}
          </p>
        )}
        <p class="sheet-note">
          Keyboard: 1-9 jumps to a chip, ← → cycles between them, Q W E R jumps between Sweet spot/CEA2034/In-room/
          Off-axis.
        </p>
        <button type="button" class="sheet-close" onClick={close}>
          Close
        </button>
      </div>
    </div>
  );
}
