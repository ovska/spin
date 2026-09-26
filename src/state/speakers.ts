import { signal } from '@preact/signals';
import type { SpeakerData, SpeakerIndexEntry } from '../core/types';

export const speakerIndex = signal<SpeakerIndexEntry[]>([]);

/** Selected speaker ids, in chip display order (1-4). */
export const selectedSpeakerIds = signal<string[]>([]);
export const activeSpeakerId = signal<string | null>(null);
export const referenceSpeakerId = signal<string | null>(null);

/** True while the plot (or a chip) is being press-and-held to peek at the
 * reference speaker. Charts show the reference while this is true. */
export const peeking = signal(false);

export type SpeakerDataState = 'loading' | 'error' | SpeakerData;
export const speakerDataCache = signal<Record<string, SpeakerDataState>>({});

export const recentSpeakerIds = signal<string[]>([]);

/** The speaker id whose data should currently be shown on charts: the
 * reference while peeking, otherwise the active speaker. */
export function visibleSpeakerId(): string | null {
  if (peeking.value && referenceSpeakerId.value) return referenceSpeakerId.value;
  return activeSpeakerId.value;
}
