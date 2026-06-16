import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
  path.join(process.cwd(), 'components/evaluation/ManuscriptSubmissionForm.jsx'),
  'utf8',
);

describe('evaluate form typography contract', () => {
  test('keeps the evaluate form body and controls on a consistent font', () => {
    expect(source).toContain('mx-auto max-w-7xl text-[17px] text-stone-950');
    expect(source).toContain('font-rg-mono');
    expect(source).toContain('font-bold uppercase');
  });

  test('preserves readable spacing for the English Variant helper text without changing copy', () => {
    expect(source).toContain(
      'Controls RevisionGrade-generated analysis, recommendations, revision guidance, and report text. Manuscript text, quotations, and evidence excerpts are preserved exactly as submitted.',
    );
    expect(source).toContain('leading-7 text-stone-700');
  });

  test('sets label and radio leading within the requested readability ranges', () => {
    expect(source).toContain('font-semibold leading-6 text-stone-900">English Variant');
    expect(source).toContain('font-semibold text-stone-900">Manuscript Structure');
    expect(source).toContain('font-semibold leading-6 text-stone-900">Evaluation Mode');
    expect(source).toContain('font-semibold leading-6 text-stone-900">Voice Preservation');
  });
});
