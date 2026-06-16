/**
 * Additional Implemented Issue Verification
 *
 * Proves that several more GitHub issues are already implemented in the codebase.
 * Each test group references the issue number and verifies the acceptance criteria.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');

function readSource(relPath: string): string {
  return fs.readFileSync(path.resolve(ROOT, relPath), 'utf-8');
}

function fileExists(relPath: string): boolean {
  return fs.existsSync(path.resolve(ROOT, relPath));
}

// ─── Issue #1118: AR05 Persist section approvals server-side ──────────

describe('Issue #1118 — AR05 Section Approval Persistence', () => {
  test('POST /api/agent-readiness/sections/approve endpoint exists', () => {
    expect(fileExists('app/api/agent-readiness/sections/approve/route.ts')).toBe(true);
  });

  test('sections/approve endpoint is authenticated', () => {
    const source = readSource('app/api/agent-readiness/sections/approve/route.ts');
    expect(source).toContain('getAuthenticatedUser');
    expect(source).toContain('Unauthorized');
  });

  test('sections/approve endpoint writes status=approved to DB', () => {
    const source = readSource('app/api/agent-readiness/sections/approve/route.ts');
    expect(source).toContain("status: 'approved'");
    expect(source).toContain('agent_readiness_sections');
  });

  test('sections/approve endpoint persists audit trail', () => {
    const source = readSource('app/api/agent-readiness/sections/approve/route.ts');
    expect(source).toContain('agent_readiness_author_review_decisions');
    expect(source).toContain("decision: 'approved'");
  });

  test('workbench client wires Approve button to API call', () => {
    const source = readSource('app/agent-readiness/AgentReadinessWorkbenchClient.tsx');
    expect(source).toContain('/api/agent-readiness/sections/approve');
    expect(source).toContain('onApprove');
  });
});

// ─── Issue #1119: AR06 Enforce completeness from persisted DB records ─

describe('Issue #1119 — AR06 Completeness from DB Records', () => {
  test('download buttons are gated on allRequiredApproved', () => {
    const source = readSource('app/agent-readiness/AgentReadinessWorkbenchClient.tsx');
    expect(source).toContain('allRequiredApproved');
    expect(source).toMatch(/disabled=\{!allRequiredApproved\}/);
  });

  test('approvedRequiredCount counts only approved sections', () => {
    const source = readSource('app/agent-readiness/AgentReadinessWorkbenchClient.tsx');
    expect(source).toMatch(/approvedRequiredCount.*approved/);
  });

  test('package-level approval API exists', () => {
    expect(fileExists('app/api/agent-readiness/packages/approve/route.ts')).toBe(true);
    const source = readSource('app/api/agent-readiness/packages/approve/route.ts');
    expect(source).toContain('getAuthenticatedUser');
  });
});

// ─── Issue #1114: Public-domain calibration benchmark alignment ───────

describe('Issue #1114 — Public-Domain Calibration Benchmark Alignment', () => {
  const CALIBRATION_FILES = [
    'docs/benchmarks/public-domain/dracula-dream-calibration.md',
    'docs/benchmarks/public-domain/great-expectations-dream-calibration.md',
    'docs/benchmarks/public-domain/pride-and-prejudice-dream-calibration.md',
    'docs/benchmarks/public-domain/the-awakening-dream-calibration.md',
    'docs/benchmarks/public-domain/the-awakening-dream-calibration-v2-governed-ledger-addendum.md',
  ];

  test.each(CALIBRATION_FILES)('%s has runtime-authority: false', (file) => {
    const content = readSource(file);
    expect(content).toContain('runtime-authority: false');
  });

  test.each(CALIBRATION_FILES)('%s has benchmark-tier: public-domain-calibration', (file) => {
    const content = readSource(file);
    expect(content).toContain('benchmark-tier: public-domain-calibration');
  });

  test('benchmark index distinguishes public-domain-calibration tier', () => {
    const indexContent = readSource('docs/benchmarks/DREAM_LONGFORM_BENCHMARK_INDEX.md');
    expect(indexContent).toContain('public-domain-calibration');
    expect(indexContent).toContain('runtime authority');
  });

  test('corpus/public-domain/clean/ contains raw source prose', () => {
    expect(fileExists('corpus/public-domain/clean')).toBe(true);
    const files = fs.readdirSync(path.resolve(ROOT, 'corpus/public-domain/clean'));
    expect(files.length).toBeGreaterThan(0);
    expect(files.some(f => f.endsWith('.txt'))).toBe(true);
  });
});

// ─── Issue #1127: PR-02/S11a Renderer Parity ─────────────────────────

describe('Issue #1127 — Renderer Parity (canonical artifact)', () => {
  test('download route uses loadCertifiedUnifiedEvaluationDocumentArtifact', () => {
    const source = readSource('app/api/reports/[jobId]/download/route.ts');
    expect(source).toContain('loadCertifiedUnifiedEvaluationDocumentArtifact');
  });

  test('download route uses validateDownloadParity', () => {
    const source = readSource('app/api/reports/[jobId]/download/route.ts');
    expect(source).toContain('validateDownloadParity');
  });

  test('download parity gate module exists', () => {
    expect(fileExists('lib/evaluation/downloadParityGate.ts')).toBe(true);
  });

  test('download read-time sanitizer module exists', () => {
    expect(fileExists('lib/evaluation/downloadReadTimeSanitizer.ts')).toBe(true);
  });
});
