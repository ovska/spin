// Build step: reads the vendored Klippel .txt exports (committed under
// data/raw/) for the 3 originally-chosen speakers and writes
// public/data/<id>.json plus public/data/index.json.
//
// For pulling in more speakers from the wider spinorama catalog without
// vendoring their raw files, see scripts/sync-measurements.ts instead.
//
// Run with `npm run data`.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { buildSpeaker, indexEntryFor, type SpeakerSource } from './lib/buildSpeaker.ts';
import { encodeSpeakerBinary } from '../src/core/binaryFormat.ts';
import type { DataIndex } from '../src/core/types.ts';

const ROOT = join(import.meta.dirname, '..');
const RAW_DIR = join(ROOT, 'data', 'raw');
const OUT_DIR = join(ROOT, 'public', 'data');

const SPEAKERS: { dir: string; id: string; name: string; brand: string; model: string }[] = [
  { dir: 'KEF R3', id: 'kef-r3', name: 'KEF R3', brand: 'KEF', model: 'R3' },
  { dir: 'Genelec 8030C', id: 'genelec-8030c', name: 'Genelec 8030C', brand: 'Genelec', model: '8030C' },
  { dir: 'Neumann KH 120 II', id: 'neumann-kh-120-ii', name: 'Neumann KH 120 II', brand: 'Neumann', model: 'KH 120 II' },
];

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });

  const index: DataIndex = { speakers: [] };

  for (const spec of SPEAKERS) {
    console.log(`Building ${spec.name}...`);
    const source: SpeakerSource = {
      asrDir: join(RAW_DIR, spec.dir, 'asr'),
      id: spec.id,
      name: spec.name,
      brand: spec.brand,
      model: spec.model,
      origin: 'Audio Science Review',
    };
    const data = buildSpeaker(source);
    writeFileSync(join(OUT_DIR, `${spec.id}.spb`), encodeSpeakerBinary(data));
    index.speakers.push(indexEntryFor(data));
  }

  writeFileSync(join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2));
  console.log(`Wrote ${index.speakers.length} speakers to ${OUT_DIR}`);
}

main();
