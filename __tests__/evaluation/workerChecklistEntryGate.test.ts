import {
  evaluateWorkerChecklistEntry,
  processQueuedJobsWithChecklistEntryGate,
  type WorkerChecklistCandidate,
} from '../../lib/evaluation/phase-architecture-v2/workerChecklistEntryGate';
import type { RuntimeArtifactRow } from '../../lib/evaluation/phase-architecture-v2/checklistRuntimeWiring';

const candidate = (phase: WorkerChecklistCandidate['phase']): WorkerChecklistCandidate => ({
  id: 'job-1',
  phase,
  status: 'queued',
  progress: {},
});

const artifact = (artifact_type: string, overrides: Record<string, unknown> = {}): RuntimeArtifactRow => ({
  id: `${artifact_type}-row-id`,
  artifact_type,
  source_hash: `${artifact_type}-source-hash`,
  created_at: '2026-05-31T00:00:00.000Z',
  content: {
    artifact_id: `${artifact_type}-artifact-id`,
    schema_valid: true,
    semantic_status: 'valid',
    is_resume_safe: true,
    checksum: `${artifact_type}-checksum`,
    ...overrides,
  },
});

describe('worker checklist entry gate', () => {
  it('blocks phase_1a without story_map_seed_v1', () => {
    const block = evaluateWorkerChecklistEntry({
      candidate: candidate('phase_1a'),
      artifacts: [artifact('phase0_authority_proof_v1')],
    });

    expect(block).not.toBeNull();
    expect(block?.phase).toBe('phase_1a');
    expect(block?.code).toBe('CHECKLIST_REQUIRED_INPUT_MISSING');
    expect(block?.reason).toContain('story_map_seed_v1');
  });

  it('allows phase_1a when authority proof and story map seed are usable', () => {
    const block = evaluateWorkerChecklistEntry({
      candidate: candidate('phase_1a'),
      artifacts: [
        artifact('phase0_authority_proof_v1'),
        artifact('story_map_seed_v1'),
      ],
    });

    expect(block).toBeNull();
  });

  it('blocks phase_2 without accepted_story_context_v1', () => {
    const block = evaluateWorkerChecklistEntry({
      candidate: candidate('phase_2'),
      artifacts: [],
    });

    expect(block).not.toBeNull();
    expect(block?.phase).toBe('phase_2');
    expect(block?.reason).toContain('accepted_story_context_v1');
  });

  it('allows phase_2 when accepted_story_context_v1 is usable', () => {
    const block = evaluateWorkerChecklistEntry({
      candidate: candidate('phase_2'),
      artifacts: [artifact('accepted_story_context_v1')],
    });

    expect(block).toBeNull();
  });

  it('ignores non-governed phases', () => {
    const block = evaluateWorkerChecklistEntry({
      candidate: candidate('phase_3'),
      artifacts: [],
    });

    expect(block).toBeNull();
  });

  it('runs processQueuedJobs after checklist gate seam completes', async () => {
    const calls: string[] = [];
    const supabase = {
      from: () => ({
        select: () => ({
          in: () => ({
            in: () => ({
              order: () => ({
                limit: async () => ({ data: [], error: null }),
              }),
            }),
          }),
        }),
      }),
    } as never;

    const result = await processQueuedJobsWithChecklistEntryGate({
      supabase,
      workerId: 'worker-1',
      batchSize: 1,
      leaseMs: 1000,
      processQueuedJobs: async () => {
        calls.push('processQueuedJobs');
        return { claimed: 0, processed: 0, succeeded: 0, failed: 0, errors: [] };
      },
    });

    expect(calls).toEqual(['processQueuedJobs']);
    expect(result.checklistGate.checked).toBe(0);
    expect(result.checklistGate.blocked).toEqual([]);
  });
});
