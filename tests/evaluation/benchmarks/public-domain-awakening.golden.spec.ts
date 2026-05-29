import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = process.cwd();
const AWAKENING_PATH = join(
  REPO_ROOT,
  'docs/benchmarks/public-domain/the-awakening-dream-calibration.md',
);
const AWAKENING_ADDENDUM_PATH = join(
  REPO_ROOT,
  'docs/benchmarks/public-domain/the-awakening-dream-calibration-v2-governed-ledger-addendum.md',
);
const INDEX_PATH = join(
  REPO_ROOT,
  'docs/benchmarks/DREAM_LONGFORM_BENCHMARK_INDEX.md',
);

function read(filePath: string): string {
  return readFileSync(filePath, 'utf8');
}

describe('Public-domain gold fixture harness — The Awakening', () => {
  it('keeps both calibration body and governed-ledger addendum present', () => {
    expect(existsSync(AWAKENING_PATH)).toBe(true);
    expect(existsSync(AWAKENING_ADDENDUM_PATH)).toBe(true);
  });

  it('keeps runtime authority false and public-domain calibration tier', () => {
    const body = read(AWAKENING_PATH);
    const addendum = read(AWAKENING_ADDENDUM_PATH);

    expect(body).toContain('runtime-authority: false');
    expect(body).toContain('benchmark-tier: public-domain-calibration');
    expect(addendum).toContain('runtime-authority: false');
    expect(addendum).toContain('benchmark-tier: public-domain-calibration');
  });

  it('preserves key Awakening detection doctrine in the base calibration', () => {
    const body = read(AWAKENING_PATH).toLowerCase();

    expect(body).toContain('interiority as plot pressure');
    expect(body).toContain('social role constraint as antagonistic pressure');
    expect(body).toContain('ambiguous closure');
    expect(body).toContain('do not use this benchmark to force modern commercial pacing');
  });

  it('keeps all six governed-ledger sections in the addendum', () => {
    const addendum = read(AWAKENING_ADDENDUM_PATH);

    expect(addendum).toContain('## Character Coverage & Arc Ledger');
    expect(addendum).toContain('## Relationship Spine Ledger');
    expect(addendum).toContain('## Symbol-to-Character Payoff Ledger');
    expect(addendum).toContain('## Sensory / Emotional Register Ledger');
    expect(addendum).toContain('## Manuscript Integrity Confidence Notes');
    expect(addendum).toContain('## Evidence Distribution / Confidence Notes');
  });

  it('anchors required character and symbol systems for Awakening', () => {
    const addendum = read(AWAKENING_ADDENDUM_PATH);

    for (const token of [
      'Edna Pontellier',
      'Léonce Pontellier',
      'Robert Lebrun',
      'Adèle Ratignolle',
      'Mlle. Reisz',
      'Sea / water',
      'Birds',
      'Piano / music',
    ]) {
      expect(addendum).toContain(token);
    }
  });

  it('is registered in benchmark index as public-domain calibration with addendum', () => {
    const index = read(INDEX_PATH);

    expect(index).toContain('*The Awakening*');
    expect(index).toContain('public-domain/the-awakening-dream-calibration.md');
    expect(index).toContain('public-domain/the-awakening-dream-calibration-v2-governed-ledger-addendum.md');
    expect(index).toContain('runtime-authority: false');
  });
});
