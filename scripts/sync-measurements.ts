// Syncs additional speakers from the wider spinorama measurement catalog
// (beyond the 3 vendored under data/raw/) without retaining any raw files:
// clones spinorama into a temp directory, runs spinorama_catalog.py to pick
// out Klippel-format, high-quality-by-default speakers sourced from ASR or
// Erin's Audio Corner, processes each straight out of the temp checkout
// into public/data/<id>.json, merges them into public/data/index.json,
// then deletes the temp checkout.
//
// Run with `npm run sync` (add -- --help for options).

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildSpeaker, hasRequiredFiles, indexEntryFor, type SpeakerSource } from './lib/buildSpeaker.ts';
import { encodeSpeakerBinary } from '../src/core/binaryFormat.ts';
import type { DataIndex, SpeakerIndexEntry } from '../src/core/types.ts';

const REPO_URL = 'https://github.com/pierreaubert/spinorama.git';
// Same commit scripts/fetch-data.sh pins for the original 3 speakers -
// reproducible by default; pass --ref to pull a newer snapshot.
const DEFAULT_REF = 'acc757bb98d63327092ee537bde25d9c227811f3';

const ROOT = join(import.meta.dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'data');
const CATALOG_SCRIPT = join(import.meta.dirname, 'spinorama_catalog.py');

type Quality = 'low' | 'medium' | 'high';

// ASR ships a LICENSE.txt per measurement (CC BY-NC-SA 4.0); EAC doesn't -
// see processCatalog's licenseFallback for how that's attributed instead.
const DEFAULT_ORIGINS = ['ASR', 'ErinsAudioCorner'];

interface CliOptions {
  ref: string;
  minQuality: Quality;
  origins: string;
  limit: number | null;
  only: Set<string> | null;
  dryRun: boolean;
}

interface CatalogEntry {
  id: string;
  brand: string | null;
  model: string | null;
  name: string;
  measurementKey: string;
  quality: Quality;
  origin: string;
  originDisplayName: string;
  reviewUrl: string | null;
}

function printHelp(): void {
  console.log(`Usage: npm run sync -- [options]

  --ref <sha-or-branch>     spinorama commit/branch to sync from
                             (default: ${DEFAULT_REF}, the same commit
                             scripts/fetch-data.sh pins)
  --min-quality <tier>      low | medium | high (default: high) - only
                             speakers whose default measurement meets this
                             spinorama-assigned quality tier are synced
  --origins <list>          comma-separated spinorama origins to accept
                             (default: ${DEFAULT_ORIGINS.join(',')})
  --limit <n>               only process the first n qualifying speakers
                             (useful for a quick test run)
  --only <id,id,...>        only these catalog ids (see --dry-run for ids)
  --dry-run                 print the qualifying catalog and exit; clones
                             and processes nothing
  --help                    show this help
`);
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    ref: DEFAULT_REF,
    minQuality: 'high',
    origins: DEFAULT_ORIGINS.join(','),
    limit: null,
    only: null,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--ref') opts.ref = argv[++i];
    else if (arg === '--min-quality') {
      const v = argv[++i];
      if (v !== 'low' && v !== 'medium' && v !== 'high') throw new Error(`--min-quality must be low|medium|high, got "${v}"`);
      opts.minQuality = v;
    } else if (arg === '--origins') opts.origins = argv[++i];
    else if (arg === '--limit') opts.limit = Number(argv[++i]);
    else if (arg === '--only') opts.only = new Set(argv[++i].split(',').map((s) => s.trim()).filter(Boolean));
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else throw new Error(`unknown argument: ${arg}`);
  }
  return opts;
}

function git(cwd: string, args: string[]): void {
  execFileSync('git', args, { cwd, stdio: 'inherit' });
}

function measurementPath(entry: CatalogEntry): string {
  return `datas/measurements/${entry.name}/${entry.measurementKey}`;
}

function cloneSparse(workDir: string, ref: string): void {
  console.log(`Cloning ${REPO_URL} (blobless, sparse) at ${ref}...`);
  git(workDir, ['clone', '--filter=blob:none', '--sparse', '--no-checkout', REPO_URL, 'repo']);
  const repo = join(workDir, 'repo');
  // Phase 1: just enough to run the catalog script.
  git(repo, ['sparse-checkout', 'set', '--no-cone', '/datas/*.py']);
  git(repo, ['checkout', ref]);
}

function loadCatalog(repoDir: string, minQuality: Quality, origins: string): CatalogEntry[] {
  const out = execFileSync(
    'python3',
    [CATALOG_SCRIPT, repoDir, '--min-quality', minQuality, '--origins', origins],
    { encoding: 'utf-8' },
  );
  return JSON.parse(out) as CatalogEntry[];
}

function checkoutMeasurements(repoDir: string, entries: CatalogEntry[]): void {
  const patterns = ['/datas/*.py', ...entries.map((e) => `/${measurementPath(e)}/*`)];
  // git sparse-checkout set replaces the pattern list wholesale, which is
  // fine here - we re-supply the phase-1 pattern too so it stays checked out.
  git(repoDir, ['sparse-checkout', 'set', '--no-cone', ...patterns]);
}

interface SyncResult {
  built: SpeakerIndexEntry[];
  skipped: { id: string; name: string; reason: string }[];
}

function processCatalog(repoDir: string, entries: CatalogEntry[]): SyncResult {
  mkdirSync(OUT_DIR, { recursive: true });
  const built: SpeakerIndexEntry[] = [];
  const skipped: SyncResult['skipped'] = [];

  entries.forEach((entry, i) => {
    const asrDir = join(repoDir, 'datas', 'measurements', entry.name, entry.measurementKey);
    if (!hasRequiredFiles(asrDir)) {
      skipped.push({ id: entry.id, name: entry.name, reason: 'missing SPL Horizontal.txt/SPL Vertical.txt' });
      return;
    }
    const licenseFallback = entry.reviewUrl
      ? `No license file is published for this ${entry.originDisplayName} measurement. Original review: ${entry.reviewUrl}`
      : `No license file is published for this ${entry.originDisplayName} measurement (source: spinorama.org).`;
    const source: SpeakerSource = {
      asrDir,
      id: entry.id,
      name: entry.name,
      origin: entry.originDisplayName,
      licenseFallback,
    };
    try {
      const data = buildSpeaker(source);
      writeFileSync(join(OUT_DIR, `${entry.id}.spb`), encodeSpeakerBinary(data));
      built.push(indexEntryFor(data));
      console.log(`  [${i + 1}/${entries.length}] ${entry.name} -> ${entry.id}.spb`);
    } catch (err) {
      skipped.push({ id: entry.id, name: entry.name, reason: (err as Error).message });
    }
  });

  return { built, skipped };
}

function mergeIndex(newEntries: SpeakerIndexEntry[]): DataIndex {
  const indexPath = join(OUT_DIR, 'index.json');
  const existing: DataIndex = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf-8')) : { speakers: [] };
  const byId = new Map(existing.speakers.map((s) => [s.id, s]));
  for (const entry of newEntries) byId.set(entry.id, entry);
  const speakers = Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
  const merged: DataIndex = { speakers };
  writeFileSync(indexPath, JSON.stringify(merged, null, 2));
  return merged;
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));

  const workDir = mkdtempSync(join(tmpdir(), 'spin-sync-'));
  try {
    cloneSparse(workDir, opts.ref);
    const repoDir = join(workDir, 'repo');

    let catalog = loadCatalog(repoDir, opts.minQuality, opts.origins);
    if (opts.only) catalog = catalog.filter((e) => opts.only!.has(e.id));
    if (opts.limit != null) catalog = catalog.slice(0, opts.limit);

    if (opts.dryRun) {
      console.log(JSON.stringify(catalog, null, 2));
      console.log(`\n${catalog.length} speakers would be synced (dry run, nothing fetched or written).`);
      return;
    }

    console.log(`Fetching measurement files for ${catalog.length} speakers...`);
    checkoutMeasurements(repoDir, catalog);

    const { built, skipped } = processCatalog(repoDir, catalog);
    const index = mergeIndex(built);

    console.log(`\nBuilt ${built.length} speakers (${index.speakers.length} total in public/data/index.json).`);
    if (skipped.length > 0) {
      console.log(`Skipped ${skipped.length}:`);
      for (const s of skipped) console.log(`  - ${s.name} (${s.id}): ${s.reason}`);
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

main();
