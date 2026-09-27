// Compact on-disk/on-wire encoding for a SpeakerData record: same shape as
// its JSON form, except every leaf array of numbers is stored once as a
// contiguous float32 payload instead of decimal text. Our curve/impulse
// data is already rounded to 2-6 decimal places by buildSpeaker, well
// within float32's ~7 significant digits, so this loses nothing that
// matters while cutting file size (numbers no longer round-trip through
// text) and replacing JSON.parse's decimal tokenizing with plain typed-
// array reads.
//
// Layout: [u32 header length, LE][UTF-8 JSON header, padded to 4 bytes]
// [float32 payload]. The header mirrors the source object/array tree with
// each number[] leaf replaced by a {"$f32": index} reference into a
// `lengths` list (in encounter order) - generic over shape, so it doesn't
// need to hardcode SpeakerData's fields.

import type { SpeakerData } from './types.ts';

interface F32Ref {
  $f32: number;
}

function isF32Ref(node: unknown): node is F32Ref {
  return !!node && typeof node === 'object' && !Array.isArray(node) && '$f32' in (node as Record<string, unknown>);
}

function isNumberArray(node: unknown): node is number[] {
  return Array.isArray(node) && node.length > 0 && typeof node[0] === 'number';
}

function walkEncode(node: unknown, lengths: number[], chunks: number[][]): unknown {
  if (isNumberArray(node)) {
    const idx = lengths.length;
    lengths.push(node.length);
    chunks.push(node);
    const ref: F32Ref = { $f32: idx };
    return ref;
  }
  if (Array.isArray(node)) return node.map((child) => walkEncode(child, lengths, chunks));
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) out[k] = walkEncode(v, lengths, chunks);
    return out;
  }
  return node;
}

export function encodeSpeakerBinary(data: SpeakerData): Uint8Array {
  const lengths: number[] = [];
  const chunks: number[][] = [];
  const header = walkEncode(data, lengths, chunks);

  const headerBytes = new TextEncoder().encode(JSON.stringify({ header, lengths }));
  const totalFloats = lengths.reduce((a, b) => a + b, 0);
  const headerLenPadded = Math.ceil((4 + headerBytes.length) / 4) * 4;
  const buf = new ArrayBuffer(headerLenPadded + totalFloats * 4);

  new DataView(buf).setUint32(0, headerBytes.length, true);
  new Uint8Array(buf, 4, headerBytes.length).set(headerBytes);

  const floatView = new Float32Array(buf, headerLenPadded);
  let offset = 0;
  for (const chunk of chunks) {
    floatView.set(chunk, offset);
    offset += chunk.length;
  }

  return new Uint8Array(buf);
}

function walkDecode(node: unknown, offsets: number[], lengths: number[], floatView: Float32Array): unknown {
  if (isF32Ref(node)) {
    const idx = node.$f32;
    return Array.from(floatView.subarray(offsets[idx], offsets[idx] + lengths[idx]));
  }
  if (Array.isArray(node)) return node.map((child) => walkDecode(child, offsets, lengths, floatView));
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) out[k] = walkDecode(v, offsets, lengths, floatView);
    return out;
  }
  return node;
}

export function decodeSpeakerBinary(buf: ArrayBuffer): SpeakerData {
  const dv = new DataView(buf);
  const headerLen = dv.getUint32(0, true);
  const headerText = new TextDecoder().decode(new Uint8Array(buf, 4, headerLen));
  const { header, lengths } = JSON.parse(headerText) as { header: unknown; lengths: number[] };

  const headerLenPadded = Math.ceil((4 + headerLen) / 4) * 4;
  const floatView = new Float32Array(buf, headerLenPadded);

  const offsets: number[] = [];
  let acc = 0;
  for (const len of lengths) {
    offsets.push(acc);
    acc += len;
  }

  return walkDecode(header, offsets, lengths, floatView) as SpeakerData;
}
