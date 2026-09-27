import { describe, expect, it } from 'vitest';
import { decodeSpeakerBinary, encodeSpeakerBinary } from '../binaryFormat';
import type { SpeakerData } from '../types';

// encodeSpeakerBinary always allocates its own fresh ArrayBuffer, so this
// slice is never actually shared - the cast just satisfies TS, which can't
// narrow Uint8Array#buffer past ArrayBufferLike.
function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

const sample: SpeakerData = {
  id: 'test-speaker',
  name: 'Test Speaker',
  origin: 'ASR',
  license: 'CC BY-NC-SA 4.0',
  freqHz: [20, 200, 2000, 20000],
  cea2034: {
    freqHz: [20, 200, 2000, 20000],
    onAxis: [80.12, 81.5, 79.99, 60],
    listeningWindow: [80, 81, 80, 61],
  },
  horizontal: {
    'On Axis': [80.12, 81.5, 79.99, 60],
    '10°': [79, 80, 78, 58],
    '-10°': [79, 80, 78, 58],
  },
  vertical: {
    'On Axis': [80.12, 81.5, 79.99, 60],
  },
  stepImpulse: {
    timeMs: [0, 0.02, 0.04],
    impulse: [0.001, 1.234567, -0.5],
    step: [0, 0.5, 1],
  },
};

describe('binaryFormat', () => {
  it('round-trips a full SpeakerData record through float32 within negligible error', () => {
    const encoded = encodeSpeakerBinary(sample);
    const decoded = decodeSpeakerBinary(toArrayBuffer(encoded));

    expect(decoded.id).toBe(sample.id);
    expect(decoded.name).toBe(sample.name);
    expect(decoded.origin).toBe(sample.origin);
    expect(decoded.license).toBe(sample.license);
    expect(Object.keys(decoded.horizontal!)).toEqual(Object.keys(sample.horizontal!));

    const maxAbsError = (a: number[], b: number[]) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
    expect(maxAbsError(decoded.freqHz, sample.freqHz)).toBeLessThan(1e-3);
    expect(maxAbsError(decoded.cea2034!.onAxis!, sample.cea2034!.onAxis!)).toBeLessThan(1e-3);
    expect(maxAbsError(decoded.horizontal!['10°'], sample.horizontal!['10°'])).toBeLessThan(1e-3);
    expect(maxAbsError(decoded.stepImpulse!.impulse, sample.stepImpulse!.impulse)).toBeLessThan(1e-5);
  });

  it('produces a smaller payload than the equivalent JSON at realistic curve lengths', () => {
    // A handful of numbers has fixed per-array header overhead that swamps
    // any savings - real speaker data has ~90 curves of ~479 points each,
    // so use a comparable size here for the size comparison to mean anything.
    const curve = Array.from({ length: 479 }, (_, i) => Math.round((70 + 20 * Math.sin(i / 10)) * 100) / 100);
    const realistic: SpeakerData = {
      ...sample,
      freqHz: curve,
      cea2034: { freqHz: curve, onAxis: curve, listeningWindow: curve },
      horizontal: Object.fromEntries(Array.from({ length: 36 }, (_, i) => [`${i * 10}°`, curve])),
    };
    const json = JSON.stringify(realistic);
    const encoded = encodeSpeakerBinary(realistic);
    expect(encoded.byteLength).toBeLessThan(new TextEncoder().encode(json).length * 0.7);
  });

  it('handles a speaker with no optional views (id/name/origin/license/freqHz only)', () => {
    const minimal: SpeakerData = {
      id: 'bare',
      name: 'Bare Speaker',
      origin: 'ASR',
      license: '',
      freqHz: [20, 20000],
    };
    const encoded = encodeSpeakerBinary(minimal);
    const decoded = decodeSpeakerBinary(toArrayBuffer(encoded));
    expect(decoded).toEqual({ ...minimal, freqHz: expect.arrayContaining(minimal.freqHz) });
    expect(decoded.freqHz.length).toBe(2);
  });
});
