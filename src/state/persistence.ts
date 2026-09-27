// localStorage preferences and the URL hash. Both are best-effort: every
// localStorage access is wrapped in try/catch so the app still works when
// storage is unavailable (private browsing, quota, etc).

import { effect } from '@preact/signals';
import type { SmoothingMode } from '../core/smoothing';
import { smoothing, ySpanDb, zoomPreset, xRange, ZOOM_RANGES, type YSpanDb, type ZoomPreset } from './settings';
import { activeSpeakerId, referenceSpeakerId, recentSpeakerIds, selectedSpeakerIds } from './speakers';
import { currentTab, type ViewId, ALL_VIEWS } from './ui';
import { offAxisAngleDeg, offAxisPlane } from './offaxis';
import { applyTheme, themeMode, type ThemeMode } from './theme';

const PREFS_KEY = 'spin:prefs';
const RECENT_LIMIT = 8;

interface Prefs {
  smoothing: SmoothingMode;
  ySpanDb: YSpanDb;
  zoomPreset: ZoomPreset;
  recentSpeakerIds: string[];
  themeMode: ThemeMode;
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable - preferences just won't persist this session
  }
}

const THEME_MODES: ThemeMode[] = ['auto', 'light', 'dark'];

/** Reads and applies the saved theme synchronously, before Preact renders -
 * called from main.tsx so a forced dark/light choice never flashes the
 * other theme on first paint. loadPrefs() (called later, from App's effect)
 * re-reads the same blob into the reactive signal. */
export function applyInitialTheme(): void {
  const raw = safeGet(PREFS_KEY);
  if (!raw) return;
  try {
    const prefs: Partial<Prefs> = JSON.parse(raw);
    if (prefs.themeMode && THEME_MODES.includes(prefs.themeMode)) applyTheme(prefs.themeMode);
  } catch {
    // corrupt prefs blob - ignore and start fresh
  }
}

export function loadPrefs(): void {
  const raw = safeGet(PREFS_KEY);
  if (!raw) return;
  try {
    const prefs: Partial<Prefs> = JSON.parse(raw);
    if (prefs.smoothing) smoothing.value = prefs.smoothing;
    if (prefs.ySpanDb) ySpanDb.value = prefs.ySpanDb;
    if (prefs.zoomPreset) {
      zoomPreset.value = prefs.zoomPreset;
      xRange.value = ZOOM_RANGES[prefs.zoomPreset];
    }
    if (Array.isArray(prefs.recentSpeakerIds)) recentSpeakerIds.value = prefs.recentSpeakerIds;
    if (prefs.themeMode && THEME_MODES.includes(prefs.themeMode)) themeMode.value = prefs.themeMode;
  } catch {
    // corrupt prefs blob - ignore and start fresh
  }
}

export function startPrefsPersistence(): void {
  effect(() => {
    applyTheme(themeMode.value);
  });
  effect(() => {
    const prefs: Prefs = {
      smoothing: smoothing.value,
      ySpanDb: ySpanDb.value,
      zoomPreset: zoomPreset.value,
      recentSpeakerIds: recentSpeakerIds.value,
      themeMode: themeMode.value,
    };
    safeSet(PREFS_KEY, JSON.stringify(prefs));
  });
}

export function noteRecentSpeaker(id: string): void {
  const rest = recentSpeakerIds.value.filter((existing) => existing !== id);
  recentSpeakerIds.value = [id, ...rest].slice(0, RECENT_LIMIT);
}

// ---- URL hash ----

let applyingHash = false;

function parseHash(hash: string): URLSearchParams {
  return new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
}

export function decodeHashToState(): void {
  const params = parseHash(location.hash);
  if ([...params.keys()].length === 0) return;

  applyingHash = true;
  try {
    const s = params.get('s');
    if (s) selectedSpeakerIds.value = s.split(',').filter(Boolean);

    const a = params.get('a');
    if (a) activeSpeakerId.value = a;

    const r = params.get('r');
    referenceSpeakerId.value = r || null;

    const tab = params.get('tab');
    if (tab && (ALL_VIEWS as string[]).includes(tab)) currentTab.value = tab as ViewId;

    const z = params.get('z');
    if (z) {
      const [lo, hi] = z.split('-').map(Number);
      if (Number.isFinite(lo) && Number.isFinite(hi)) xRange.value = [lo, hi];
    }

    const y = params.get('y');
    if (y && ['5', '10', '25'].includes(y)) ySpanDb.value = Number(y) as YSpanDb;

    const sm = params.get('sm');
    if (sm) smoothing.value = decodeSmoothing(sm);

    const plane = params.get('plane');
    if (plane === 'horizontal' || plane === 'vertical') offAxisPlane.value = plane;

    const angle = params.get('angle');
    if (angle && Number.isFinite(Number(angle))) offAxisAngleDeg.value = Number(angle);
  } finally {
    applyingHash = false;
  }
}

function encodeSmoothing(mode: SmoothingMode): string {
  return mode.replace('/', '_');
}
function decodeSmoothing(token: string): SmoothingMode {
  const restored = token.replace('_', '/');
  return (['none', '1/12', '1/6', '1/3', 'erb'] as SmoothingMode[]).includes(restored as SmoothingMode)
    ? (restored as SmoothingMode)
    : 'none';
}

function buildHash(): string {
  const params = new URLSearchParams();
  if (selectedSpeakerIds.value.length) params.set('s', selectedSpeakerIds.value.join(','));
  if (activeSpeakerId.value) params.set('a', activeSpeakerId.value);
  if (referenceSpeakerId.value) params.set('r', referenceSpeakerId.value);
  params.set('tab', currentTab.value);
  params.set('z', `${xRange.value[0]}-${xRange.value[1]}`);
  params.set('y', String(ySpanDb.value));
  params.set('sm', encodeSmoothing(smoothing.value));
  params.set('plane', offAxisPlane.value);
  params.set('angle', String(offAxisAngleDeg.value));
  return `#${params.toString()}`;
}

let xRangeDebounce: ReturnType<typeof setTimeout> | null = null;

export function startHashSync(): void {
  window.addEventListener('hashchange', decodeHashToState);

  // Discrete state -> push a history entry, so back/forward step through it.
  effect(() => {
    // touch the discrete signals so this effect re-runs on their change
    void selectedSpeakerIds.value;
    void activeSpeakerId.value;
    void referenceSpeakerId.value;
    void currentTab.value;
    void ySpanDb.value;
    void smoothing.value;
    void offAxisPlane.value;
    if (applyingHash) return;
    const hash = buildHash();
    if (hash !== location.hash) history.pushState(null, '', hash);
  });

  // Continuous zoom/pan/scrub -> replace, debounced, so dragging doesn't
  // flood history.
  effect(() => {
    void xRange.value;
    void offAxisAngleDeg.value;
    if (applyingHash) return;
    if (xRangeDebounce) clearTimeout(xRangeDebounce);
    xRangeDebounce = setTimeout(() => {
      const hash = buildHash();
      if (hash !== location.hash) history.replaceState(null, '', hash);
    }, 250);
  });
}
