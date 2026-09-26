import { useEffect } from 'preact/hooks';
import { ensureSpeakerLoaded, loadSpeakerIndex } from './data/api';
import { decodeHashToState, loadPrefs, noteRecentSpeaker, startHashSync, startPrefsPersistence } from './state/persistence';
import { activeSpeakerId, referenceSpeakerId, selectedSpeakerIds, speakerIndex } from './state/speakers';
import { currentTab } from './state/ui';
import { SpeakerChips } from './components/SpeakerChips';
import { SpeakerPicker } from './components/SpeakerPicker';
import { ViewTabs } from './components/ViewTabs';
import { PlotView } from './components/PlotView';
import { CursorReadout } from './components/CursorReadout';
import { Controls } from './components/Controls';
import { AboutSheet } from './components/AboutSheet';
import { aboutOpen } from './state/ui';
import './app.css';

function handleArrowKeys(e: KeyboardEvent): void {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const ids = selectedSpeakerIds.value;
  if (ids.length < 2) return;
  const idx = ids.indexOf(activeSpeakerId.value ?? '');
  if (idx === -1) return;
  const next = e.key === 'ArrowRight' ? (idx + 1) % ids.length : (idx - 1 + ids.length) % ids.length;
  activeSpeakerId.value = ids[next];
}

export function App() {
  useEffect(() => {
    loadPrefs();
    decodeHashToState();
    startPrefsPersistence();
    startHashSync();

    void loadSpeakerIndex().then(() => {
      if (selectedSpeakerIds.value.length === 0) {
        const ids = speakerIndex.value.slice(0, 3).map((s) => s.id);
        selectedSpeakerIds.value = ids;
        activeSpeakerId.value = ids[0] ?? null;
        referenceSpeakerId.value = ids[1] ?? null;
      }
      for (const id of selectedSpeakerIds.value) {
        void ensureSpeakerLoaded(id);
        noteRecentSpeaker(id);
      }
    });

    window.addEventListener('keydown', handleArrowKeys);
    return () => window.removeEventListener('keydown', handleArrowKeys);
  }, []);

  return (
    <div class="app">
      <header class="app-header">
        <span class="app-header__title">Spin</span>
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
      </header>
      <SpeakerChips />
      <ViewTabs />
      <PlotView view={currentTab.value} />
      <CursorReadout />
      <Controls />
      <SpeakerPicker />
      <AboutSheet />
    </div>
  );
}
