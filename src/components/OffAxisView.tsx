import { useEffect, useRef } from 'preact/hooks';
import { effect } from '@preact/signals';
import { OffAxisHeatmapController } from '../charts/OffAxisHeatmapController';
import { OffAxisCurveController } from '../charts/OffAxisCurveController';
import { attachGestures } from '../charts/gestures';
import { H_ANGLE_MIN, H_ANGLE_MAX, V_ANGLE_MIN, V_ANGLE_MAX } from '../charts/offAxisTable';
import { activeSpeakerId, peeking, referenceSpeakerId, selectedSpeakerIds, speakerDataCache } from '../state/speakers';
import { smoothing, xRange, ySpanDb } from '../state/settings';
import { activeWindow } from '../state/sweetspot';
import { offAxisAngleDeg, offAxisPlane, type OffAxisPlane } from '../state/offaxis';
import type { SpeakerData } from '../core/types';

function angleRangeFor(plane: OffAxisPlane): [number, number] {
  return plane === 'horizontal' ? [H_ANGLE_MIN, H_ANGLE_MAX] : [V_ANGLE_MIN, V_ANGLE_MAX];
}

export function OffAxisView() {
  const heatmapRef = useRef<HTMLDivElement>(null);
  const curveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const heatmapEl = heatmapRef.current;
    const curveEl = curveRef.current;
    if (!heatmapEl || !curveEl) return undefined;

    const heatmap = new OffAxisHeatmapController(heatmapEl);
    const curve = new OffAxisCurveController(curveEl);

    function visibleId(): string | null {
      return peeking.value && referenceSpeakerId.value ? referenceSpeakerId.value : activeSpeakerId.value;
    }

    const disposers = [
      effect(() => {
        const ids = selectedSpeakerIds.value;
        const cache = speakerDataCache.value;
        const mode = smoothing.value;
        for (const id of ids) {
          const data = cache[id];
          if (data && data !== 'loading' && data !== 'error') {
            heatmap.ensureSpeaker(id, data as SpeakerData, mode);
            curve.ensureSpeaker(id, data as SpeakerData, mode);
          }
        }
        heatmap.pruneTo(new Set(ids));
        curve.pruneTo(new Set(ids));
        heatmap.setVisible(visibleId());
        curve.setVisible(visibleId());
      }),
      effect(() => {
        heatmap.setXRange(xRange.value);
        curve.setXRange(xRange.value);
      }),
      effect(() => {
        curve.applyYSpan(ySpanDb.value);
      }),
      effect(() => {
        heatmap.applySmoothing(smoothing.value);
        curve.applySmoothing(smoothing.value);
      }),
      effect(() => {
        const plane = offAxisPlane.value;
        heatmap.setPlane(plane);
        curve.setPlane(plane);
      }),
      effect(() => {
        const deg = offAxisAngleDeg.value;
        heatmap.setSelectedAngle(deg);
        curve.setAngle(deg);
      }),
      effect(() => {
        heatmap.setSweetSpotWindow(activeWindow.value);
      }),
    ];

    const detachHeatmapGestures = attachGestures(heatmapEl, {
      getRange: () => xRange.value,
      setRange: (r) => {
        xRange.value = r;
      },
      onTap: (_xFraction, yFraction) => {
        const [angMin, angMax] = angleRangeFor(offAxisPlane.value);
        const angle = Math.round(angMax - yFraction * (angMax - angMin));
        offAxisAngleDeg.value = Math.max(angMin, Math.min(angMax, angle));
      },
      onHoldStart: () => {
        peeking.value = true;
      },
      onHoldEnd: () => {
        peeking.value = false;
      },
    });

    const detachCurveGestures = attachGestures(curveEl, {
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

    const heatmapResize = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) heatmap.resize(e.contentRect.width, e.contentRect.height);
    });
    heatmapResize.observe(heatmapEl);
    const curveResize = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) curve.resize(e.contentRect.width, e.contentRect.height);
    });
    curveResize.observe(curveEl);

    return () => {
      for (const d of disposers) d();
      detachHeatmapGestures();
      detachCurveGestures();
      heatmapResize.disconnect();
      curveResize.disconnect();
      heatmap.dispose();
      curve.dispose();
    };
  }, []);

  const plane = offAxisPlane.value;
  const [angMin, angMax] = angleRangeFor(plane);
  const angle = offAxisAngleDeg.value;
  const measuredAngles: number[] = [];
  for (let a = Math.ceil(angMin / 10) * 10; a <= angMax; a += 10) measuredAngles.push(a);

  return (
    <div class="offaxis-view">
      <div class="offaxis-view__controls-row">
        <div class="offaxis-view__toolbar">
          <button
            type="button"
            class={`chip-btn${plane === 'horizontal' ? ' chip-btn--active' : ''}`}
            onClick={() => {
              offAxisPlane.value = 'horizontal';
              offAxisAngleDeg.value = 0;
            }}
          >
            Horizontal
          </button>
          <button
            type="button"
            class={`chip-btn${plane === 'vertical' ? ' chip-btn--active' : ''}`}
            onClick={() => {
              offAxisPlane.value = 'vertical';
              offAxisAngleDeg.value = 0;
            }}
          >
            Vertical
          </button>
        </div>
        <div class="offaxis-view__slider">
          <input
            type="range"
            min={angMin}
            max={angMax}
            step={1}
            value={angle}
            list="offaxis-measured-angles"
            onInput={(e) => {
              offAxisAngleDeg.value = Number((e.target as HTMLInputElement).value);
            }}
          />
          {/* Tick marks at the actual measured angles (every 10°) - the rest
           * of the range is PCHIP-interpolated between them, see offAxisTable.ts. */}
          <datalist id="offaxis-measured-angles">
            {measuredAngles.map((deg) => (
              <option key={deg} value={deg} />
            ))}
          </datalist>
          <span class="offaxis-view__angle-label">{angle}°</span>
        </div>
      </div>
      <div ref={heatmapRef} class="plot-host offaxis-heatmap" />
      <div ref={curveRef} class="plot-host offaxis-curve" />
    </div>
  );
}
