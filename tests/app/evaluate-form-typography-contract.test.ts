import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
  path.join(process.cwd(), 'components/evaluation/ManuscriptSubmissionForm.jsx'),
  'utf8',
);

describe('evaluate form typography contract', () => {
  test('keeps the evaluate form body and controls on a consistent sans font', () => {
    expect(source).toContain('mx-auto max-w-7xl font-sans text-[17px] leading-normal text-stone-950');
    expect(source).toContain('font-sans text-base leading-[1.45] text-stone-950');
    expect(source).toContain('font-sans text-base leading-[1.45] text-stone-900');
    expect(source).toContain('font-sans text-base font-bold uppercase leading-[1.35] tracking-[0.12em] text-white');
  });

  test('preserves readable spacing for the English Variant helper text without changing copy', () => {
    expect(source).toContain(
      'Controls RevisionGrade-generated analysis, recommendations, revision guidance, and report text. Manuscript text, quotations, and evidence excerpts are preserved exactly as submitted.',
    );
    expect(source).toContain('mt-4 text-[0.95rem] leading-[1.45] text-stone-700');
  });

  test('sets label and radio leading within the requested readability ranges', () => {
    expect(source).toContain('font-semibold leading-[1.25] text-stone-900">English Variant');
    expect(source).toContain('font-semibold leading-[1.25] text-stone-900">Manuscript Structure');
    expect(source).toContain('font-semibold leading-[1.25] text-stone-900">Evaluation Mode');
    expect(source).toContain('font-semibold leading-[1.25] text-stone-900">Voice Preservation');
    expect(source).toContain('font-sans text-base leading-[1.35] text-stone-900');
    expect(source).toContain('<span className="leading-[1.35]">Chapter(s) from a larger work</span>');
    expect(source).toContain('<span className="leading-[1.35]">Standalone story</span>');
  });
});
