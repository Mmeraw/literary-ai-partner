import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('pre-live shadow proof assets', () => {
  const root = process.cwd();

  it('keeps the deterministic Evaluate to Revise E2E proof in the full Jest suite', () => {
    const source = readFileSync(join(root, '__tests__/lib/pipeline-e2e-proof.test.ts'), 'utf8');

    expect(source).toContain('evaluation_result_v2');
    expect(source).toContain('opportunity ledger');
    expect(source).toContain('workbench card');
    expect(source).toContain('completion certification');
    expect(source).toContain('creator approval');
    expect(source).toContain('export');
  });

  it('keeps the real Evaluate smoke on the canonical production kickoff and output authorities', () => {
    const source = readFileSync(join(root, 'scripts/jobs-smoke-real.mjs'), 'utf8');

    expect(source).toContain('POST /api/jobs');
    expect(source).toContain('/evaluation-result');
    expect(source).toContain('download?format=');
    expect(source).toContain('assertTerminalComplete');
  });

  it('fails closed about the remaining live Revise author-action proof gap', () => {
    const source = readFileSync(join(root, 'scripts/revision/c2LiveProofHarness.mjs'), 'utf8');

    expect(source).toContain('candidate generation stage would run here');
    expect(source).toContain('accept/customize + persistence stage would run here');
    expect(source).toContain('NOT_EXECUTED');
  });

  it('does not mislabel readiness or fixture coverage as live proof', () => {
    const source = readFileSync(join(root, 'scripts/revision/c2LiveProofHarness.mjs'), 'utf8');

    expect(source).toContain('Dry-run can never emit a live C2 PASS');
    expect(source).toContain('Not a synthetic test');
  });
});
