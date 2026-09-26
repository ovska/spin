// Maps the current tab to its live chart controller, so components outside
// the plot (the cursor readout row) can query series values. Backed by a
// signal (not a plain object) so that readout re-renders once the
// controller for a newly-switched-to tab actually exists, instead of
// showing stale/empty values until some unrelated signal happens to change.

import { signal } from '@preact/signals';
import type { ChartController } from './ChartController';
import type { ViewId } from '../state/ui';

const controllers = signal<Partial<Record<ViewId, ChartController>>>({});

export function registerController(view: ViewId, controller: ChartController | null): void {
  const next = { ...controllers.value };
  if (controller) next[view] = controller;
  else delete next[view];
  controllers.value = next;
}

export function getController(view: ViewId): ChartController | null {
  return controllers.value[view] ?? null;
}
