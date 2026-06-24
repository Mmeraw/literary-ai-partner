import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSeedBenchmarkContext } from '@/lib/evaluation/seed/benchmarkContextBuilder';

const REPO_ROOT = process.cwd();
const STORY_LEDGER_DIR = join(REPO_ROOT, 'docs/benchmarks/story-ledger');
const CARTEL_LEDGER_PATH = join(STORY_LEDGER_DIR, 'IDEAL_STORY_LEDGER_10_LAYER_BENCHMARK_CARTEL_BABIES.md');
const FROGGIN_LEDGER_PATH = join(STORY_LEDGER_DIR, 'IDEAL_STORY_LEDGER_10_LAYER_BENCHMARK_FROGGIN_NOGGIN.md');
const RIVER_LEDGER_PATH = join(STORY_LEDGER_DIR, 'IDEAL_STORY_LEDGER_10_LAYER_BENCHMARK_LET_THE_RIVER_DECIDE.md');
const INDEX_PATH = join(REPO_ROOT, 'docs/benchmarks/DREAM_LONGFORM_BENCHMARK_INDEX.md');
const RUNTIME_MAP_PATH = join(REPO_ROOT, 'docs/benchmarks/RUNTIME_BENCHMARK_AUTHORITY_MAP.md');

function read(filePath: string): string {
  return readFileSync(filePath, 'utf8');
}

describe('Native Story Ledger canon — Cartel Babies primary example', () => {
  it('keeps all native Story Ledger answer keys present', () => {
    expect(existsSync(CARTEL_LEDGER_PATH)).toBe(true);
    expect(existsSync(FROGGIN_LEDGER_PATH)).toBe(true);
    expect(existsSync(RIVER_LEDGER_PATH)).toBe(true);
  });

  it('uses Cartel Babies as the canonical required-gold product example', () => {
    const ledger = read(CARTEL_LEDGER_PATH);

    expect(ledger).toContain('benchmark-schema: ideal-story-ledger-10-layer-v1');
    expect(ledger).toContain('benchmark-tier: required-gold');
    expect(ledger).toContain('revised: 2026-05-31T03:56:00Z');
    expect(ledger).toContain('docs/benchmarks/cartel-babies-dream-longform-multilayer-gold-standard.md');
  });

  it('guards the Cartel Babies completion standard and ten-layer doctrine', () => {
    const ledger = read(CARTEL_LEDGER_PATH);

    for (const token of [
      'Benjamin as dual-POV co-protagonist',
      'Paolito-to-Paul identity transformation',
      'Raúl / Navarro governance conflict',
      'Cobra as critical hidden-traitor',
      'Diego as loyalty-tax / weak-link pressure',
      "El Tomatero's red bat",
      'pig pen / pigs as disposal-terror object-system',
      'Radio-channel punishment system',
      'Canadian Embassy / CBSA / Public Safety Canada',
      'Layer 9 — Threat / Pressure / Ending',
    ]) {
      expect(ledger).toContain(token);
    }
  });

  it('keeps DREAM index authority aligned with native benchmark tiers', () => {
    const index = read(INDEX_PATH);

    expect(index).toContain('| *Cartel Babies* | [`cartel-babies-dream-longform-multilayer-gold-standard.md`](./cartel-babies-dream-longform-multilayer-gold-standard.md)');
    expect(index).toContain('| Required gold |');
    expect(index).toContain('| *Let the River Decide* | [`let-the-river-decide-dream-longform-multilayer-gold-standard.md`](./let-the-river-decide-dream-longform-multilayer-gold-standard.md)');
    expect(index).toContain('| Calibration |');
  });

  it('guards the runtime benchmark authority map coverage', () => {
    const runtimeMap = read(RUNTIME_MAP_PATH);

    for (const path of [
      'docs/benchmarks/return-to-the-source-dream-longform-multilayer-gold-standard.md',
      'docs/benchmarks/lost-world-of-mythoamphibia-dream-longform-multilayer-gold-standard.md',
      'docs/benchmarks/cartel-babies-dream-longform-multilayer-gold-standard.md',
      'docs/benchmarks/cartel-babies-criminal-network-suspense-architecture-addendum.md',
      'docs/benchmarks/let-the-river-decide-dream-longform-multilayer-gold-standard.md',
      'docs/benchmarks/let-the-river-decide-expedition-wilderness-architecture-addendum.md',
      'docs/benchmarks/froggin-noggin-dream-longform-multilayer-gold-standard.md',
      'docs/benchmarks/public-domain/the-wonderful-wizard-of-oz-dream-calibration.md',
      'docs/benchmarks/public-domain/the-murder-on-the-links-dream-calibration-multilayer-addendum.md',
    ]) {
      expect(runtimeMap).toContain(path);
    }
  });

  it('injects Cartel Babies plus full benchmark family coverage into seed context', () => {
    const longFormContext = buildSeedBenchmarkContext('LONG_FORM');
    const shortFormContext = buildSeedBenchmarkContext('SHORT_FORM');
    const retiredDisplayName = ['Ancient', 'Bloodlines'].join(' ');
    const retiredSlug = ['ancient', 'bloodlines'].join('-');

    for (const context of [longFormContext, shortFormContext]) {
      expect(context).toContain('COMPLETED BENCHMARK EXEMPLAR — STORY LEDGER (Cartel Babies, required-gold)');
      expect(context).toContain('IDEAL_STORY_LEDGER_10_LAYER_BENCHMARK_CARTEL_BABIES.md');
      expect(context).toContain('CURRENT BENCHMARK FAMILY COVERAGE');
      expect(context).toContain('Return to the Source');
      expect(context).toContain('The Lost World of MythOAmphibia');
      expect(context).toContain('The Murder on the Links');
      expect(context).toContain('The Wonderful Wizard of Oz');
      expect(context).not.toContain(retiredDisplayName);
      expect(context).not.toContain(retiredSlug);
    }
  });
});
