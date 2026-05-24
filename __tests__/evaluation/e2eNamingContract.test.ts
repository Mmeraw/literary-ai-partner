/**
 * E2E naming contract guard.
 *
 * Purpose: prevent recurrence of the most expensive evaluation-pipeline drift:
 *   - pass1a_story_ledger_v1 vs pass1a_story_layer_v1
 *   - evaluation_job_id vs evaluation_artifacts.job_id in operational SQL
 *   - completed/succeeded/done vs complete as terminal job status
 *   - lease_expires_at as writable field vs lease_until
 *
 * This test intentionally checks runtime-critical files and the canonical E2E
 * checklist. Docs/tests may mention banned terms as examples, but runtime code
 * and copy-safe SQL must use canonical labels.
 */

import fs from 'fs';
import path from 'path';

function readRepoFile(repoPath: string): string {
  return fs.readFileSync(path.resolve(__dirname, '../..', repoPath), 'utf8');
}

function expectAbsent(haystack: string, needle: string, context: string): void {
  expect(haystack.includes(needle)).toBe(false);
}

describe('E2E evaluation naming contract', () => {
  const processorSrc = readRepoFile('lib/evaluation/processor.ts');
  const storyExtensionSrc = readRepoFile('lib/evaluation/phase1a/storyLedgerExtensions.ts');
  const e2eChecklist = readRepoFile('docs/evaluation/E2E_EVALUATION_FORENSIC_CHECKLIST.md');
  const namingGovernance = readRepoFile('docs/SCHEMA_CODE_NAMING_GOVERNANCE.md');

  it('uses pass1a_story_layer_v1 as the only runtime Phase 1A story artifact name', () => {
    expect(processorSrc).toContain('pass1a_story_layer_v1');
    expectAbsent(processorSrc, 'pass1a_story_ledger_v1', 'processor.ts');

    expect(storyExtensionSrc).toContain('pass1a_story_layer_v1');
    // The extension module may use human-facing Story Ledger language, but it
    // must not refer to a non-canonical stored artifact name.
    expectAbsent(storyExtensionSrc, "canonical code artifact is pass1a_story_ledger_v1", 'storyLedgerExtensions.ts');
  });

  it('keeps the E2E checklist copy-safe for evaluation_artifacts.job_id', () => {
    expect(e2eChecklist).toContain('evaluation_artifacts.job_id');
    expect(e2eChecklist).toContain('from evaluation_artifacts');
    expect(e2eChecklist).toContain('select\n  job_id,');
    expect(e2eChecklist).toContain('group by job_id');
    expect(e2eChecklist).toContain('left join artifacts a on a.job_id = j.id');

    // The checklist may list evaluation_job_id as a reject/avoid example, but
    // no runnable SQL block should use it as a selected/grouped/joined column.
    expect(e2eChecklist).not.toContain('select\n  evaluation_job_id');
    expect(e2eChecklist).not.toContain('group by evaluation_job_id');
    expect(e2eChecklist).not.toContain('a.evaluation_job_id = j.id');
  });

  it('uses complete as terminal job status in runtime and copy-safe E2E SQL', () => {
    expect(processorSrc).toContain("status: JOB_STATUS.COMPLETE");
    expect(e2eChecklist).toContain("status = 'complete'");
    expect(namingGovernance).toContain('queued | running | failed | complete');

    expect(e2eChecklist).not.toContain("status = 'completed'");
    expect(e2eChecklist).not.toContain("status = 'succeeded'");
  });

  it('uses review_gate and awaiting_approval as the canonical approval checkpoint labels', () => {
    expect(processorSrc).toContain('review_gate');
    expect(processorSrc).toContain('awaiting_approval');
    expect(e2eChecklist).toContain("phase = 'review_gate'");
    expect(e2eChecklist).toContain("phase_status = 'awaiting_approval'");

    expectAbsent(processorSrc, 'approval_gate', 'processor.ts');
    expectAbsent(processorSrc, 'pending_approval', 'processor.ts');
  });

  it('keeps lease_until as the writable lease expiry field in E2E guidance', () => {
    expect(e2eChecklist).toContain('lease_until');
    expect(namingGovernance).toContain('lease_until');
    expect(namingGovernance).toContain('Do not write:');
    expect(namingGovernance).toContain('lease_expires_at');
  });
});
