import { useEffect } from 'preact/hooks';
import { ensureSpeakerLoaded, loadSpeakerIndex } from './data/api';
import { decodeHashToState, loadPrefs, noteRecentSpeaker, startHashSync, startPrefsPersistence } from './state/persistence';
import { activeSpeakerId, referenceSpeakerId, selectedSpeakerIds, speakerIndex } from './state/speakers';
import { currentTab, aboutOpen, settingsOpen, type ViewId } from './state/ui';
import { SpeakerChips } from './components/SpeakerChips';
import { SpeakerPicker } from './components/SpeakerPicker';
import { ViewTabs } from './components/ViewTabs';
import { PlotView } from './components/PlotView';
import { OffAxisView } from './components/OffAxisView';
import { Controls } from './components/Controls';
import { AboutSheet } from './components/AboutSheet';
import { SweetSpotSettingsSheet } from './components/SweetSpotSettingsSheet';
import { ThemeToggle } from './components/ThemeToggle';
import { GearIcon } from './components/icons';
import './app.css';

const DEFAULT_SPEAKER_IDS = ['kef-r3', 'genelec-8030c', 'neumann-kh-120-ii'];

// Desktop-only quick-select: number keys jump straight to the Nth selected
// speaker (chip order), QWER jumps straight to a tab, in the same
// left-to-right order they're displayed in.
const TAB_KEYS: Record<string, ViewId> = { q: 'sweetspot', w: 'cea2034', e: 'inroom', r: 'offaxis' };

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;
}

function handleKeyboardShortcuts(e: KeyboardEvent): void {
  if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;

  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const ids = selectedSpeakerIds.value;
    if (ids.length < 2) return;
    const idx = ids.indexOf(activeSpeakerId.value ?? '');
    if (idx === -1) return;
    const next = e.key === 'ArrowRight' ? (idx + 1) % ids.length : (idx - 1 + ids.length) % ids.length;
    activeSpeakerId.value = ids[next];
    return;
  }

  if (e.key >= '1' && e.key <= '9') {
    const ids = selectedSpeakerIds.value;
    const idx = Number(e.key) - 1;
    if (idx < ids.length) activeSpeakerId.value = ids[idx];
    return;
  }

  const tab = TAB_KEYS[e.key.toLowerCase()];
  if (tab) currentTab.value = tab;
}

export function App() {
  useEffect(() => {
    loadPrefs();
    decodeHashToState();
    startPrefsPersistence();
    startHashSync();

    void loadSpeakerIndex().then(() => {
      if (selectedSpeakerIds.value.length === 0) {
        const available = new Set(speakerIndex.value.map((s) => s.id));
        // Prefer the 3 originally-curated speakers as the first-run default
        // regardless of how large the synced catalog has grown - otherwise
        // this would just be whichever 3 sort first alphabetically.
        const preferred = DEFAULT_SPEAKER_IDS.filter((id) => available.has(id));
        const rest = speakerIndex.value.map((s) => s.id).filter((id) => !preferred.includes(id));
        const ids = [...preferred, ...rest].slice(0, 3);
        selectedSpeakerIds.value = ids;
        activeSpeakerId.value = ids[0] ?? null;
        referenceSpeakerId.value = ids[1] ?? null;
      }
      for (const id of selectedSpeakerIds.value) {
        void ensureSpeakerLoaded(id);
        noteRecentSpeaker(id);
      }
    });

    window.addEventListener('keydown', handleKeyboardShortcuts);
    return () => window.removeEventListener('keydown', handleKeyboardShortcuts);
  }, []);

  const tab = currentTab.value;

  return (
    <div class="app">
      <header class="app-header">
        <span class="app-header__brand">
          <img class="app-header__logo" src={`${import.meta.env.BASE_URL}logo-192.png`} alt="" width="24" height="24" />
          <span class="app-header__text">
            <span class="app-header__title">Spin</span>
            <span class="app-header__version">
              {__APP_VERSION__} · {speakerIndex.value.length} speakers
            </span>
          </span>
        </span>
        <div class="app-header__actions">
          <ThemeToggle />
          <button
            type="button"
            class="app-header__about"
            aria-label="About"
            onClick={() => {
              aboutOpen.value = true;
            }}
          >
            i
          </button>
        </div>
      </header>
      <SpeakerChips />
      <div class="tabs-with-settings">
        <ViewTabs />
        {tab === 'sweetspot' && (
          <button
            type="button"
            class="tabs-with-settings__gear"
            aria-label="Sweet spot settings"
            onClick={() => {
              settingsOpen.value = true;
            }}
          >
            <GearIcon />
          </button>
        )}
      </div>
      {tab === 'offaxis' ? <OffAxisView /> : <PlotView view={tab} />}
      {tab === 'sweetspot' && <p class="sweetspot-note">Off-plane points estimated from H/V planes.</p>}
      <Controls />
      <SpeakerPicker />
      <AboutSheet />
      <SweetSpotSettingsSheet />
    </div>
  );
}
