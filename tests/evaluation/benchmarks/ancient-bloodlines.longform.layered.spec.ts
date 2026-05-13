import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const TEMPLATE_PATH = join(
  process.cwd(),
  'docs/benchmarks/ancient-bloodlines-longform-layered-template.md'
);
const GOLD_PATH = join(
  process.cwd(),
  'docs/benchmarks/ancient-bloodlines-longform-layered.md'
);

function readDoc(filePath: string): string {
  return readFileSync(filePath, 'utf8');
}

describe('Ancient Bloodlines — long-form layered gold standard', () => {
  it('keeps the layered template present in the repo', () => {
    const template = readDoc(TEMPLATE_PATH);

    expect(template).toContain('Multi-Layer / Multi-Voice Long Form');
    expect(template).toContain('Layer & Voice Map');
    expect(template).toContain('Doctrine / Glyph System Integrity');
    expect(template).toContain('Evaluator guardrails');
    expect(template).toContain('<manuscript title>');
  });

  it('keeps the completed Ancient Bloodlines long-form evaluation present in the repo', () => {
    const gold = readDoc(GOLD_PATH);

    expect(gold).toContain('Ancient Bloodlines—Love Between Species');
    expect(gold).toContain('Multi-Layer / Multi-Voice Long Form');
    expect(gold).toContain('Embodied wetland survival');
    expect(gold).toContain('Doctrine / herd governance');
    expect(gold).toContain('Mythic / symbolic moral architecture');
    expect(gold).toContain('Layer & Mode Integration');
    expect(gold).toContain('Doctrine / Glyph System Integrity');
    expect(gold).toContain('Canon & Continuity Integrity');
  });

  it('anchors the completed evaluation in Ancient Bloodlines canon and evidence', () => {
    const gold = readDoc(GOLD_PATH);

    for (const token of ['Newton', 'Rana', 'Twillow', 'Snappy', 'Thorander']) {
      expect(gold).toContain(token);
    }

    for (const anchor of ['AB-001', 'AB-005', 'AB-013', 'AB-020']) {
      expect(gold).toContain(anchor);
    }
  });

  it('records a real long-form score grid with multi-layer-specific rows', () => {
    const gold = readDoc(GOLD_PATH);

    expect(gold).toContain('Layer & Mode Integration');
    expect(gold).toContain('Layer Coherence');
    expect(gold).toContain('Doctrine / Glyph System Integrity');
    expect(gold).toContain('Canon & Continuity Integrity');
    expect(gold).toContain('7.5/10');
    expect(gold).toContain('5.5/10');
  });
});