import { ensureSpeakerLoaded } from '../data/api';
import { activeSpeakerId, recentSpeakerIds, selectedSpeakerIds, speakerIndex } from '../state/speakers';
import { noteRecentSpeaker } from '../state/persistence';
import { pickerOpen } from '../state/ui';

export function SpeakerPicker() {
  if (!pickerOpen.value) return null;

  const recent = recentSpeakerIds.value;
  const ordered = [...speakerIndex.value].sort((a, b) => {
    const ra = recent.indexOf(a.id);
    const rb = recent.indexOf(b.id);
    if (ra === -1 && rb === -1) return 0;
    if (ra === -1) return 1;
    if (rb === -1) return -1;
    return ra - rb;
  });

  function pick(id: string): void {
    if (!selectedSpeakerIds.value.includes(id)) {
      selectedSpeakerIds.value = [...selectedSpeakerIds.value, id].slice(0, 4);
    }
    activeSpeakerId.value = id;
    noteRecentSpeaker(id);
    void ensureSpeakerLoaded(id);
    pickerOpen.value = false;
  }

  function close(): void {
    pickerOpen.value = false;
  }

  return (
    <div class="sheet-backdrop" onClick={close}>
      <div class="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Choose a speaker</h2>
        <ul class="sheet-list">
          {ordered.map((entry) => (
            <li key={entry.id}>
              <button type="button" onClick={() => pick(entry.id)} disabled={selectedSpeakerIds.value.includes(entry.id)}>
                {entry.name}
                <span class="sheet-list__origin">{entry.origin}</span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" class="sheet-close" onClick={close}>
          Close
        </button>
      </div>
    </div>
  );
}
