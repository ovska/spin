import { useRef } from 'preact/hooks';
import { activeSpeakerId, referenceSpeakerId, selectedSpeakerIds, speakerIndex } from '../state/speakers';
import { pickerOpen } from '../state/ui';

const HOLD_MS = 250;

function Chip({ id }: { id: string }) {
  const entry = speakerIndex.value.find((s) => s.id === id);
  const isActive = activeSpeakerId.value === id;
  const isReference = referenceSpeakerId.value === id;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heldRef = useRef(false);

  function onPointerDown(): void {
    heldRef.current = false;
    timerRef.current = setTimeout(() => {
      heldRef.current = true;
      referenceSpeakerId.value = id;
    }, HOLD_MS);
  }

  function clearTimer(): void {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function onPointerUp(): void {
    clearTimer();
    if (!heldRef.current) {
      activeSpeakerId.value = id;
    }
  }

  return (
    <button
      type="button"
      class={`chip${isActive ? ' chip--active' : ''}${isReference ? ' chip--reference' : ''}`}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={clearTimer}
      onPointerCancel={clearTimer}
    >
      {entry?.name ?? id}
    </button>
  );
}

export function SpeakerChips() {
  const ids = selectedSpeakerIds.value;
  return (
    <div class="chip-row">
      {ids.map((id) => (
        <Chip key={id} id={id} />
      ))}
      {ids.length < 4 && (
        <button
          type="button"
          class="chip chip--add"
          aria-label="Add speaker"
          onClick={() => {
            pickerOpen.value = true;
          }}
        >
          +
        </button>
      )}
    </div>
  );
}
