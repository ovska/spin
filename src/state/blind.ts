import { signal } from '@preact/signals';
import { selectedSpeakerIds } from './speakers';

export const blindMode = signal(false);
export const blindLetters = signal<Record<string, string>>({});
export const pickedSpeakerId = signal<string | null>(null);
export const revealed = signal(false);

const LETTERS = ['A', 'B', 'C', 'D'];

function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function enableBlindMode(): void {
  const ids = shuffled(selectedSpeakerIds.value);
  selectedSpeakerIds.value = ids;
  const letters: Record<string, string> = {};
  ids.forEach((id, i) => {
    letters[id] = LETTERS[i] ?? '?';
  });
  blindLetters.value = letters;
  pickedSpeakerId.value = null;
  revealed.value = false;
  blindMode.value = true;
}

export function disableBlindMode(): void {
  blindMode.value = false;
  blindLetters.value = {};
  pickedSpeakerId.value = null;
  revealed.value = false;
}

export function pickActiveSpeaker(activeId: string | null): void {
  if (!activeId) return;
  pickedSpeakerId.value = activeId;
  revealed.value = true;
}
