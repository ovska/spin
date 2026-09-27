// Pointer-event gesture handling for a plot: horizontal drag pans the log
// frequency axis, pinch zooms it, a press-and-hold (~250ms, plot not the
// chip) peeks at the reference speaker, and a quick tap reports where on
// the plot it landed (onTap is optional - the off-axis heatmap uses it to
// pick an angle, other views have no use for a tap and omit it). uPlot's
// own drag-to-zoom box is disabled (see uplotBase.ts) so this is the only
// thing driving x-range changes from user input.

const TAP_MAX_MOVE_PX = 10;
const HOLD_MS = 250;
const MIN_SPAN_OCTAVES = 1 / 3;

export interface GestureCallbacks {
  /** Current x range in Hz, read fresh on every gesture step. */
  getRange: () => [number, number];
  setRange: (range: [number, number]) => void;
  onTap?: (xFraction: number, yFraction: number) => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
}

interface ActivePointer {
  id: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
}

function log10(x: number): number {
  return Math.log(x) / Math.LN10;
}

const DOMAIN_MIN = 20;
const DOMAIN_MAX = 20000;

function clampRange([lo, hi]: [number, number]): [number, number] {
  let loLog = log10(Math.max(lo, 1));
  let hiLog = log10(Math.max(hi, lo + 1));
  const domainMinLog = log10(DOMAIN_MIN);
  const domainMaxLog = log10(DOMAIN_MAX);
  const minSpanLog = MIN_SPAN_OCTAVES; // log2 vs log10 doesn't matter for a floor
  if (hiLog - loLog < minSpanLog) {
    const mid = (hiLog + loLog) / 2;
    loLog = mid - minSpanLog / 2;
    hiLog = mid + minSpanLog / 2;
  }
  const span = hiLog - loLog;
  if (loLog < domainMinLog) {
    loLog = domainMinLog;
    hiLog = Math.min(domainMaxLog, loLog + span);
  }
  if (hiLog > domainMaxLog) {
    hiLog = domainMaxLog;
    loLog = Math.max(domainMinLog, hiLog - span);
  }
  return [Math.pow(10, loLog), Math.pow(10, hiLog)];
}

export function attachGestures(el: HTMLElement, cb: GestureCallbacks): () => void {
  const pointers = new Map<number, ActivePointer>();
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let holding = false;
  let gestureStartedDrag = false;
  let pinchStartDist = 0;
  let pinchStartRange: [number, number] = [20, 20000];

  function clearHoldTimer(): void {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  }

  function endHold(): void {
    clearHoldTimer();
    if (holding) {
      holding = false;
      cb.onHoldEnd();
    }
  }

  function pointerArray(): ActivePointer[] {
    return Array.from(pointers.values());
  }

  function onPointerDown(e: PointerEvent): void {
    el.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { id: e.pointerId, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY });
    gestureStartedDrag = false;

    if (pointers.size === 1) {
      clearHoldTimer();
      holdTimer = setTimeout(() => {
        holding = true;
        cb.onHoldStart();
      }, HOLD_MS);
    } else if (pointers.size === 2) {
      clearHoldTimer();
      endHold();
      const [a, b] = pointerArray();
      pinchStartDist = Math.hypot(a.x - b.x, a.y - b.y);
      pinchStartRange = cb.getRange();
    }
  }

  function onPointerMove(e: PointerEvent): void {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;

    if (pointers.size === 2) {
      e.preventDefault();
      const [a, b] = pointerArray();
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchStartDist < 1) return;
      const scale = dist / pinchStartDist;
      const rect = el.getBoundingClientRect();
      const centerPx = (a.x + b.x) / 2 - rect.left;
      const [lo, hi] = pinchStartRange;
      const loLog = log10(lo);
      const hiLog = log10(hi);
      const centerLog = loLog + (centerPx / rect.width) * (hiLog - loLog);
      const newLoLog = centerLog - (centerLog - loLog) / scale;
      const newHiLog = centerLog + (hiLog - centerLog) / scale;
      cb.setRange(clampRange([Math.pow(10, newLoLog), Math.pow(10, newHiLog)]));
      return;
    }

    const dx = p.x - p.startX;
    const dy = p.y - p.startY;
    if (!gestureStartedDrag) {
      if (Math.abs(dx) < TAP_MAX_MOVE_PX && Math.abs(dy) < TAP_MAX_MOVE_PX) return;
      // Only claim the gesture (and cancel hold/tap) once movement is
      // clearly horizontal; otherwise let the page's native pan-y scroll it.
      if (Math.abs(dx) <= Math.abs(dy)) return;
      gestureStartedDrag = true;
      clearHoldTimer();
      endHold();
    }

    e.preventDefault();
    const rect = el.getBoundingClientRect();
    const [lo, hi] = cb.getRange();
    const loLog = log10(lo);
    const hiLog = log10(hi);
    const shiftLog = (dx / rect.width) * (hiLog - loLog);
    cb.setRange(clampRange([Math.pow(10, loLog - shiftLog), Math.pow(10, hiLog - shiftLog)]));
    p.startX = p.x;
    p.startY = p.y;
  }

  function onPointerUp(e: PointerEvent): void {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);

    if (pointers.size === 0) {
      clearHoldTimer();
      const wasHolding = holding;
      endHold();
      if (!gestureStartedDrag && !wasHolding && p) {
        const dx = Math.abs(p.x - p.startX);
        const dy = Math.abs(p.y - p.startY);
        if (dx < TAP_MAX_MOVE_PX && dy < TAP_MAX_MOVE_PX) {
          const rect = el.getBoundingClientRect();
          cb.onTap?.((p.x - rect.left) / rect.width, (p.y - rect.top) / rect.height);
        }
      }
      gestureStartedDrag = false;
    } else if (pointers.size === 1) {
      // Dropped from pinch back to a single pointer: restart drag tracking
      // from here rather than jumping using the stale start position.
      const [remaining] = pointerArray();
      remaining.startX = remaining.x;
      remaining.startY = remaining.y;
      pinchStartDist = 0;
    }
  }

  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerUp);

  return () => {
    clearHoldTimer();
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointercancel', onPointerUp);
  };
}
