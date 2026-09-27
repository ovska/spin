import type { DataIndex, SpeakerData } from '../core/types';
import { decodeSpeakerBinary } from '../core/binaryFormat';
import { speakerDataCache, speakerIndex } from '../state/speakers';

const base = import.meta.env.BASE_URL;

export async function loadSpeakerIndex(): Promise<void> {
  const res = await fetch(`${base}data/index.json`);
  const data: DataIndex = await res.json();
  speakerIndex.value = data.speakers;
}

export async function ensureSpeakerLoaded(id: string): Promise<void> {
  const existing = speakerDataCache.value[id];
  if (existing === 'loading' || (existing && existing !== 'error')) return;

  speakerDataCache.value = { ...speakerDataCache.value, [id]: 'loading' };
  try {
    const res = await fetch(`${base}data/${id}.spb`);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data: SpeakerData = decodeSpeakerBinary(await res.arrayBuffer());
    speakerDataCache.value = { ...speakerDataCache.value, [id]: data };
  } catch {
    speakerDataCache.value = { ...speakerDataCache.value, [id]: 'error' };
  }
}
