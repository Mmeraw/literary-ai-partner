import { describe, expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

const FORM_PATH = path.join(process.cwd(), 'components/evaluation/ManuscriptSubmissionForm.jsx');

describe('Evaluate submission form mode-control removal guard', () => {
  test('submission form must not render evaluation-mode or voice-preservation controls', () => {
    const source = fs.readFileSync(FORM_PATH, 'utf8');

    const forbiddenSubmissionLabels = [
      'Evaluation Mode',
      'Voice Preservation Level',
      'Trauma' + ' Memoir',
      'TRANSGRESSIVE',
      'POLISHED',
      'MAXIMUM',
      'BALANCED',
    ];

    for (const label of forbiddenSubmissionLabels) {
      expect(source).not.toContain(label);
    }

    expect(source).toContain('RevisionGrade confirms the final mode during analysis.');
    expect(source).toContain('Estimated Mode');
  });
});
