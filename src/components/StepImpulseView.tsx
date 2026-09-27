import { useEffect, useRef } from 'preact/hooks';
import { effect } from '@preact/signals';
import { StepImpulseController } from '../charts/StepImpulseController';
import { registerController } from '../charts/registry';
import { activeSpeakerId, peeking, referenceSpeakerId, selectedSpeakerIds, speakerDataCache } from '../state/speakers';
import type { SpeakerData } from '../core/types';

/** Step/impulse has none of the frequency-view machinery (no shared zoom,
 * no smoothing, no gesture pan/pinch - see StepImpulseController) - just
 * per-speaker instances flipped by visibility, like every other view. */
export function StepImpulseView() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const controller = new StepImpulseController(container);
    registerController('step', controller);

    const dispose = effect(() => {
      const ids = selectedSpeakerIds.value;
      const cache = speakerDataCache.value;
      for (const id of ids) {
        const data = cache[id];
        if (data && data !== 'loading' && data !== 'error') {
          controller.ensureSpeaker(id, data as SpeakerData, 'none');
        }
      }
      controller.pruneTo(new Set(ids));

      const visibleId = peeking.value && referenceSpeakerId.value ? referenceSpeakerId.value : activeSpeakerId.value;
      controller.setVisible(visibleId);
    });

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) controller.resize(entry.contentRect.width, entry.contentRect.height);
    });
    resizeObserver.observe(container);

    return () => {
      dispose();
      resizeObserver.disconnect();
      registerController('step', null);
      controller.dispose();
    };
  }, []);

  return (
    <div class="step-view">
      <p class="step-view__label">Min-phase estimate (not true timing)</p>
      <div ref={containerRef} class="plot-host" />
    </div>
  );
}
