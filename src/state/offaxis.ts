import { signal } from '@preact/signals';

export type OffAxisPlane = 'horizontal' | 'vertical';

export const offAxisPlane = signal<OffAxisPlane>('horizontal');

/** Selected scrubber angle, in degrees. Range depends on offAxisPlane:
 * horizontal is -40..40, vertical is -30..40. */
export const offAxisAngleDeg = signal<number>(0);
