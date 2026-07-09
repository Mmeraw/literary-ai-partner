import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
  path.join(process.cwd(), 'components/evaluation/ManuscriptSubmissionForm.jsx'),
  'utf8',
);

// The evaluate form was migrated to the design-system-v1 look, which moved
// typography from bare Tailwind color/size utilities to a shared `C` palette
// plus inline font sizing. These contracts assert the *intent* that survived
// the redesign: one consistent 17px ink body font, the branded mono label
// treatment, readable helper/label leading, and unchanged safety copy.
describe('evaluate form typography contract', () => {
  test('keeps the evaluate form body and controls on a consistent font', () => {
    // Root container: centered 7xl column, 17px base size, ink body color.
    expect(source).toContain('mx-auto max-w-7xl');
    expect(source).toContain('fontSize: "17px"');
    expect(source).toContain('color: C.ink');
    // Branded eyebrow/label typography.
    expect(source).toContain('font-rg-mono');
    expect(source).toMatch(/font-(bold|semibold) uppercase/);
  });

  test('preserves readable spacing for the English Variant helper text without changing copy', () => {
    // Safety copy must remain verbatim.
    expect(source).toContain(
      'Controls RevisionGrade-generated analysis, recommendations, revision guidance, and report text. Manuscript text, quotations, and evidence excerpts are preserved exactly as submitted.',
    );
    // Helper text keeps generous line spacing for readability.
    expect(source).toContain('text-[0.95rem] leading-7');
  });

  test('sets label and radio leading within the requested readability ranges', () => {
    // Section labels render at a comfortable size with leading-6 and ink color.
    expect(source).toContain('English Variant');
    expect(source).toContain('Manuscript Structure');
    expect(source).toContain('Evaluation Mode');
    expect(source).toContain('Voice Preservation');
    expect(source).toContain('font-semibold leading-6');
  });
});
