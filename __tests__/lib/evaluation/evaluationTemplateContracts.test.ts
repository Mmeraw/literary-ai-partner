import fs from 'node:fs';
import path from 'node:path';

const TEMPLATE_ROOT = path.join(process.cwd(), 'docs/templates/evaluation');

const evaluationTemplates = [
  {
    name: 'Short-Form Evaluation Template',
    path: 'short-form-evaluation-template.md',
  },
  {
    name: 'Long-Form Evaluation Template',
    path: 'long-form-evaluation-template.md',
  },
  {
    name: 'Long-Form Multi-Layer Evaluation Template',
    path: 'long-form-multi-layer-evaluation-template.md',
  },
];

const allContractDocs = [...evaluationTemplates, { name: 'Evaluation Rendering Contract', path: 'evaluation-rendering-contract.md' }];

function readTemplate(relativePath: string): string {
  return fs.readFileSync(path.join(TEMPLATE_ROOT, relativePath), 'utf8');
}

describe('evaluation template contract documents', () => {
  test.each(evaluationTemplates)('$name exists and declares its exact template heading', ({ name, path: relativePath }) => {
    const template = readTemplate(relativePath);

    expect(template).toContain(`# ${name}`);
  });

  test.each(allContractDocs)(
    '$name uses canonical revision opportunity taxonomy and mandatory handoff artifacts',
    ({ path: relativePath }) => {
      const template = readTemplate(relativePath);

      expect(template).toContain('Recommended: [X]');
      expect(template).toContain('Optional: [X]');
      expect(template).toContain('Consider: [X]');
      expect(template).toContain('revision_opportunity_ledger_v1');
      expect(template).not.toMatch(/High Priority: \[X\]/);
      expect(template).not.toMatch(/Medium Priority: \[X\]/);
      expect(template).not.toMatch(/Low Priority: \[X\]/);
    },
  );

  test.each(evaluationTemplates)('$name requires five canonical confidence labels everywhere', ({ path: relativePath }) => {
    const template = readTemplate(relativePath);

    expect(template).toContain('Very High Confidence');
    expect(template).toContain('High Confidence');
    expect(template).toContain('Moderate Confidence');
    expect(template).toContain('Low Confidence');
    expect(template).toContain('Insufficient Evidence');
    expect(template).toContain('Market Readiness Confidence');
    expect(template).toContain('with Market Readiness Confidence');
  });

  test.each(allContractDocs)('$name does not contain old three-label-only confidence language', ({ path: relativePath }) => {
    const template = readTemplate(relativePath);

    expect(template).not.toContain('Confidence must use only:');
    expect(template).not.toContain('Confidence explanations must use one of three levels');
  });

  test.each(allContractDocs)(
    '$name requires UnifiedEvaluationDocument and Phase 5 author-exposure certification',
    ({ path: relativePath }) => {
      const template = readTemplate(relativePath);

      expect(template).toContain('UnifiedEvaluationDocument');
      expect(template).toContain('author_exposure_certification_v1');
      expect(template).toMatch(/renderer (parity )?violations?.*block/i);
    },
  );

  test('shared rendering contract names all three authoritative evaluation templates', () => {
    const renderingContract = readTemplate('evaluation-rendering-contract.md');

    for (const { path: relativePath } of evaluationTemplates) {
      expect(renderingContract).toContain(`docs/templates/evaluation/${relativePath}`);
    }
  });

  test('short-form template permits only lightweight internal scaffolds without Story Ledger authority claims', () => {
    const shortForm = readTemplate('short-form-evaluation-template.md');

    expect(shortForm).toContain('lightweight internal seed, scaffold, or ledger-support artifacts');
    expect(shortForm).toContain('must not be rendered as full Story Ledger authority');
  });

  test.each(['long-form-evaluation-template.md', 'long-form-multi-layer-evaluation-template.md'])(
    '%s hard-gates WAVE, Gate 15, Dialogue Canon, and Final External Audit defects',
    (relativePath) => {
      const template = readTemplate(relativePath);

      expect(template).toContain('WAVE, Gate 15 / Canon Governance, Dialogue Canon, and Final External Audit defects');
      expect(template).toContain('must block Phase 5 author exposure');
    },
  );
});
