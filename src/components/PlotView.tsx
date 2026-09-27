import { useEffect, useRef } from 'preact/hooks';
import { effect } from '@preact/signals';
import type { ChartController } from '../charts/ChartController';
import { Cea2034Controller } from '../charts/Cea2034Controller';
import { InRoomController } from '../charts/InRoomController';
import { SweetSpotController } from '../charts/SweetSpotController';
import { attachGestures } from '../charts/gestures';
import { activeSpeakerId, peeking, referenceSpeakerId, selectedSpeakerIds, speakerDataCache } from '../state/speakers';
import { smoothing, xRange, ySpanDb } from '../state/settings';
import { activeWindow, showPoints } from '../state/sweetspot';
import type { ViewId } from '../state/ui';
import type { SpeakerData } from '../core/types';

function createController(view: ViewId, container: HTMLElement): ChartController {
  switch (view) {
    case 'cea2034':
      return new Cea2034Controller(container);
    case 'inroom':
      return new InRoomController(container);
    case 'sweetspot':
      return new SweetSpotController(container);
    case 'offaxis':
      throw new Error('offaxis has its own OffAxisView, not PlotView');
  }
}

interface Props {
  view: ViewId;
}

/** Owns the imperative uPlot layer for one view: per-speaker instances,
 * gesture-driven pan/zoom, and wiring signals -> chart updates directly,
 * bypassing Preact's render cycle entirely (this component never re-renders
 * after mount - it reads no signals in its render body). */
export function PlotView({ view }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const controller = createController(view, container);

    const disposers: (() => void)[] = [
      // One effect for both "which speakers exist" and "which is visible":
      // a newly-loaded speaker (data arriving async) must immediately be
      // shown if it's already the active/reference one, and re-reading
      // those signals here (rather than in a separate effect keyed only on
      // them) is what makes that happen.
      effect(() => {
        const ids = selectedSpeakerIds.value;
        const cache = speakerDataCache.value;
        const mode = smoothing.value;
        for (const id of ids) {
          const data = cache[id];
          if (data && data !== 'loading' && data !== 'error') {
            controller.ensureSpeaker(id, data as SpeakerData, mode);
          }
        }
        controller.pruneTo(new Set(ids));

        const visibleId = peeking.value && referenceSpeakerId.value ? referenceSpeakerId.value : activeSpeakerId.value;
        controller.setVisible(visibleId);
      }),
      effect(() => {
        controller.setXRange(xRange.value);
      }),
      effect(() => {
        controller.applyYSpan(ySpanDb.value);
      }),
      effect(() => {
        controller.applySmoothing(smoothing.value);
      }),
    ];

    if (controller instanceof SweetSpotController) {
      disposers.push(
        effect(() => {
          controller.setWindow(activeWindow.value);
        }),
        effect(() => {
          controller.setShowPoints(showPoints.value);
        }),
      );
    }

    const detachGestures = attachGestures(container, {
      getRange: () => xRange.value,
      setRange: (r) => {
        xRange.value = r;
      },
      onHoldStart: () => {
        peeking.value = true;
      },
      onHoldEnd: () => {
        peeking.value = false;
      },
    });

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) controller.resize(entry.contentRect.width, entry.contentRect.height);
    });
    resizeObserver.observe(container);

    return () => {
      for (const dispose of disposers) dispose();
      detachGestures();
      resizeObserver.disconnect();
      controller.dispose();
    };
  }, [view]);

  return <div ref={containerRef} class="plot-host" />;
}
