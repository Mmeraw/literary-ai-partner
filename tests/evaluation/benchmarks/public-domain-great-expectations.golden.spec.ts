import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = process.cwd();
const GREAT_EXPECTATIONS_PATH = join(
  REPO_ROOT,
  'docs/benchmarks/public-domain/great-expectations-dream-calibration.md',
);

const CANONICAL_13 = [
  'Concept & Core Premise',
  'Narrative Drive & Momentum',
  'Character Depth & Psychological Coherence',
  'Point of View & Voice Control',
  'Scene Construction & Function',
  'Dialogue Authenticity & Subtext',
  'Thematic Integration',
  'World-Building & Environmental Logic',
  'Pacing & Structural Balance',
  'Prose Control & Line-Level Craft',
  'Tonal Authority & Consistency',
  'Narrative Closure & Promises Kept',
  'Professional Readiness & Market Positioning',
];

function read(filePath: string): string {
  return readFileSync(filePath, 'utf8');
}

function parseScoreRows(markdown: string): number {
  return markdown
    .split('\n')
    .filter((line) => /^\|\s*[^|]+\|\s*\*?\*?\d+(\.\d+)?\s*\/\s*10/.test(line))
    .length;
}

describe('Public-domain gold fixture harness — Great Expectations', () => {
  it('keeps the benchmark file present and tagged as non-runtime authority', () => {
    expect(existsSync(GREAT_EXPECTATIONS_PATH)).toBe(true);

    const doc = read(GREAT_EXPECTATIONS_PATH);
    expect(doc).toContain('runtime-authority: false');
    expect(doc).toContain('benchmark-tier: public-domain-calibration');
  });

  it('keeps executive verdict and full score grid surface', () => {
    const doc = read(GREAT_EXPECTATIONS_PATH);

    expect(doc).toContain('## Executive verdict');
    expect(doc).toContain('## Scores');
    expect(parseScoreRows(doc)).toBeGreaterThanOrEqual(13);

    for (const criterion of CANONICAL_13) {
      expect(doc).toContain(criterion);
    }
  });

  it('anchors required Dickens canon entities and systems', () => {
    const doc = read(GREAT_EXPECTATIONS_PATH);

    for (const token of [
      'Pip',
      'Joe',
      'Magwitch',
      'Miss Havisham',
      'Estella',
      'Satis House',
      'shame',
      'false-causality revelation',
    ]) {
      expect(doc).toContain(token);
    }
  });

  it('keeps all governed-ledger sections needed for gold calibration', () => {
    const doc = read(GREAT_EXPECTATIONS_PATH);

    expect(doc).toContain('## Character Coverage & Arc Ledger');
    expect(doc).toContain('## Relationship Spine Ledger');
    expect(doc).toContain('## Symbol-to-Character Payoff Ledger');
    expect(doc).toContain('## Sensory / Emotional Register Ledger');
    expect(doc).toContain('## Evidence Distribution / Confidence Notes');
    expect(doc).toContain('## Required Detection / Failure Conditions');
  });
});
