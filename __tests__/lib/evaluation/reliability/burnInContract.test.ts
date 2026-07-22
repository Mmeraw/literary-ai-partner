import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assessBurnIn,
  loadBurnInCohort,
  type BurnInCohortManifest,
  type BurnInOutcome,
} from '@/lib/evaluation/reliability/burnInContract';

const digest = 'a'.repeat(64);
const manifest: BurnInCohortManifest = {
  schema_version: 1,
  cohort_id: 'fixture-cohort-v1',
  source: {
    repository: 'Mmeraw/literary-ai-partner',
    commit_sha: 'b'.repeat(40),
    fixture_set_version: 'v1',
    source_kind: 'deterministic_fixture',
  },
  toolchain: { node: '24.4.1', npm: '10.9.2' },
  target_completion_rate: 0.98,
  cases: Array.from({ length: 50 }, (_, i) => ({
    case_id: `case-${i}`,
    outcome_path: `case-${i}.json`,
    outcome_sha256: digest,
  })),
};

function outcome(i: number, overrides: Partial<BurnInOutcome> = {}): BurnInOutcome {
  return {
    schema_version: 1,
    case_id: `case-${i}`,
    terminal_status: 'complete',
    terminal_failure_code: null,
    attempts: 1,
    retry_exhausted: false,
    chunks_declared: 4,
    chunks_consumed: 4,
    author_exposure_verdict: 'safe_exposed',
    ...overrides,
  };
}

describe('evaluation burn-in contract', () => {
  it('rejects an outcome changed after the cohort manifest was sealed', () => {
    const directory = mkdtempSync(join(tmpdir(), 'evaluation-burn-in-'));
    try {
      const caseOutcome = outcome(0);
      const original = `${JSON.stringify(caseOutcome)}\n`;
      writeFileSync(join(directory, 'case-0.json'), original);
      const sealedManifest: BurnInCohortManifest = {
        ...manifest,
        cases: [{
          case_id: 'case-0',
          outcome_path: 'case-0.json',
          outcome_sha256: createHash('sha256').update(original).digest('hex'),
        }],
      };
      const manifestPath = join(directory, 'manifest.json');
      writeFileSync(manifestPath, JSON.stringify(sealedManifest));
      expect(loadBurnInCohort(manifestPath).outcomes).toHaveLength(1);

      writeFileSync(join(directory, 'case-0.json'), JSON.stringify({ ...caseOutcome, attempts: 2 }));
      expect(() => loadBurnInCohort(manifestPath)).toThrow('Outcome digest mismatch: case-0');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('passes a 98% cohort while preserving classified failure and retry telemetry', () => {
    const outcomes = Array.from({ length: 50 }, (_, i) => outcome(i));
    outcomes[0] = outcome(0, {
      terminal_status: 'failed',
      terminal_failure_code: 'PASS3_LINEAGE_INCOMPLETE',
      attempts: 2,
      retry_exhausted: true,
      author_exposure_verdict: 'safely_blocked',
    });
    const report = assessBurnIn(manifest, digest, outcomes);
    expect(report.pass).toBe(true);
    expect(report.completion_rate).toBe(0.98);
    expect(report.terminal_failure_distribution).toEqual({ PASS3_LINEAGE_INCOMPLETE: 1 });
    expect(report.retries).toBe(1);
    expect(report.retry_exhausted).toBe(1);
    expect(report.chunk_coverage_rate).toBe(1);
  });

  it('fails closed on incomplete chunks, unclassified failures, and unsafe exposure', () => {
    const outcomes = Array.from({ length: 50 }, (_, i) => outcome(i));
    outcomes[0] = outcome(0, { chunks_consumed: 3 });
    outcomes[1] = outcome(1, {
      terminal_status: 'failed',
      terminal_failure_code: null,
      author_exposure_verdict: 'unsafe_exposed',
    });
    const report = assessBurnIn(manifest, digest, outcomes);
    expect(report.pass).toBe(false);
    expect(report.terminal_failure_distribution).toEqual({ UNCLASSIFIED: 1 });
    expect(report.violations).toEqual(expect.arrayContaining([
      'incomplete_chunk_coverage:case-0',
      'unclassified_terminal_failure:case-1',
      'unsafe_author_exposure',
    ]));
  });
});
