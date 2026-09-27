import { useState } from 'preact/hooks';
import { ensureSpeakerLoaded } from '../data/api';
import {
  activeSpeakerId,
  favoriteSpeakerIds,
  recentSpeakerIds,
  selectedSpeakerIds,
  speakerIndex,
  toggleFavorite,
} from '../state/speakers';
import { noteRecentSpeaker } from '../state/persistence';
import { pickerOpen, pickerSortMode, type PickerSortMode } from '../state/ui';
import type { SpeakerIndexEntry } from '../core/types';

const ORIGIN_ABBR: Record<string, string> = {
  'Audio Science Review': 'ASR',
  "Erin's Audio Corner": 'EAC',
};

const SORT_OPTIONS: { value: PickerSortMode; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'alphabetical', label: 'Alphabetical' },
  { value: 'prefScore', label: 'Preference score' },
  { value: 'lowEndExtension', label: 'Low-end extension' },
  { value: 'smoothness', label: 'Smoothness' },
];

/** Orders by the chosen mode - favorites are sorted separately, always
 * pinned first, so this only ever compares within one of those two groups. */
function compareBySortMode(a: SpeakerIndexEntry, b: SpeakerIndexEntry, mode: PickerSortMode, recent: string[]): number {
  switch (mode) {
    case 'alphabetical':
      return a.name.localeCompare(b.name);
    case 'prefScore': {
      const av = a.metrics?.prefScore ?? -Infinity;
      const bv = b.metrics?.prefScore ?? -Infinity;
      return bv - av; // higher (closer to Harman-preferred target) first
    }
    case 'lowEndExtension': {
      const av = a.metrics?.lfxHz ?? Infinity;
      const bv = b.metrics?.lfxHz ?? Infinity;
      return av - bv; // lower cutoff = deeper bass first
    }
    case 'smoothness': {
      const av = a.metrics?.smoothness ?? -Infinity;
      const bv = b.metrics?.smoothness ?? -Infinity;
      return bv - av; // flatter first
    }
    case 'recent': {
      const ra = recent.indexOf(a.id);
      const rb = recent.indexOf(b.id);
      if (ra === -1 && rb === -1) return 0;
      if (ra === -1) return 1;
      if (rb === -1) return -1;
      return ra - rb;
    }
  }
}

export function SpeakerPicker() {
  const [search, setSearch] = useState('');

  if (!pickerOpen.value) return null;

  const recent = recentSpeakerIds.value;
  const favorites = favoriteSpeakerIds.value;
  const mode = pickerSortMode.value;

  const ordered = [...speakerIndex.value].sort((a, b) => {
    const fa = favorites.includes(a.id);
    const fb = favorites.includes(b.id);
    if (fa !== fb) return fa ? -1 : 1;
    return compareBySortMode(a, b, mode, recent);
  });

  const query = search.trim().toLowerCase();
  const filtered = query ? ordered.filter((entry) => entry.name.toLowerCase().includes(query)) : ordered;
  // Capped, not the true widest brand in the (possibly 500+ speaker) list -
  // a handful of long outliers ("Definitive Technology") would otherwise
  // blow the column out for everyone else; those get truncated instead
  // (truncateBrand below), deliberately in JS rather than CSS text-overflow,
  // which is only well-defined for truncating the *end* of left-aligned
  // text - not this column's right-aligned start.
  const brandColumnChars = Math.min(14, Math.max(0, ...filtered.map((entry) => entry.brand.length)));

  function truncateBrand(brand: string): string {
    return brand.length > brandColumnChars ? `${brand.slice(0, brandColumnChars - 1)}…` : brand;
  }

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
        <select
          class="sheet-sort"
          aria-label="Sort by"
          value={mode}
          onChange={(e) => {
            pickerSortMode.value = (e.target as HTMLSelectElement).value as PickerSortMode;
          }}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Sort: {opt.label}
            </option>
          ))}
        </select>
        {ordered.length > 8 && (
          <input
            type="search"
            class="sheet-search"
            placeholder={`Search ${ordered.length} speakers…`}
            value={search}
            onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
          />
        )}
        <ul class="sheet-list">
          {filtered.map((entry) => {
            const isFavorite = favorites.includes(entry.id);
            return (
              <li key={entry.id} class="sheet-list__row">
                <button
                  type="button"
                  class="sheet-list__pick"
                  onClick={() => pick(entry.id)}
                  disabled={selectedSpeakerIds.value.includes(entry.id)}
                >
                  <span class="sheet-list__brand" style={{ width: `${brandColumnChars}ch` }}>
                    {truncateBrand(entry.brand)}
                  </span>
                  <span class="sheet-list__model">{entry.model}</span>
                </button>
                <button
                  type="button"
                  class={`sheet-list__star${isFavorite ? ' sheet-list__star--active' : ''}`}
                  aria-label={isFavorite ? `Unfavorite ${entry.name}` : `Favorite ${entry.name}`}
                  onClick={() => toggleFavorite(entry.id)}
                >
                  {isFavorite ? '★' : '☆'}
                </button>
                <span class="sheet-list__origin">{ORIGIN_ABBR[entry.origin] ?? entry.origin}</span>
              </li>
            );
          })}
          {filtered.length === 0 && <li class="sheet-list__empty">No speakers match "{search}".</li>}
        </ul>
        <button type="button" class="sheet-close" onClick={close}>
          Close
        </button>
      </div>
    </div>
  );
}
