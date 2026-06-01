import {
  assertPhase2UpstreamInputsCanonical,
  assertPhase3UpstreamInputsCanonical,
} from '@/lib/evaluation/processor';

type MaybeSingleResult = { data: unknown; error: { message: string } | null };

function makeSupabase(sequence: MaybeSingleResult[]) {
  const queue = [...sequence];
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => queue.shift() ?? { data: null, error: null },
          }),
        }),
      }),
    }),
  } as any;
}

function makeLayerDecisions(count = 9): Record<string, unknown> {
  return Array.from({ length: count }).reduce((acc, _v, i) => {
    acc[`layer_${i + 1}`] = { decision: 'accept' };
    return acc;
  }, {} as Record<string, unknown>);
}

describe('upstream canonical input guards', () => {
  it('accepts canonical phase_2 upstream accepted_story_ledger_v1 for same job/manuscript', async () => {
    const supabase = makeSupabase([
      {
        data: {
          id: 'a1',
          job_id: 'job-1',
          manuscript_id: 77,
          artifact_type: 'accepted_story_ledger_v1',
          content: {
            governance_rail: {
              layer_decisions: makeLayerDecisions(9),
            },
          },
        },
        error: null,
      },
    ]);

    await expect(assertPhase2UpstreamInputsCanonical(supabase, 'job-1', 77)).resolves.toBeUndefined();
  });

  it('rejects phase_2 when accepted ledger content job_id mismatches current job', async () => {
    const supabase = makeSupabase([
      {
        data: {
          id: 'a1',
          job_id: 'job-1',
          manuscript_id: 77,
          artifact_type: 'accepted_story_ledger_v1',
          content: {
            job_id: 'job-OLD',
            governance_rail: {
              layer_decisions: makeLayerDecisions(9),
            },
          },
        },
        error: null,
      },
    ]);

    await expect(assertPhase2UpstreamInputsCanonical(supabase, 'job-1', 77)).rejects.toThrow(
      /content\.job_id mismatch/i,
    );
  });

  it('rejects phase_3 when pass12_handoff_v1 payload is non-canonical', async () => {
    const supabase = makeSupabase([
      {
        data: {
          id: 'accepted-1',
          job_id: 'job-2',
          manuscript_id: 91,
          artifact_type: 'accepted_story_ledger_v1',
          content: {
            governance_rail: {
              layer_decisions: makeLayerDecisions(9),
            },
          },
        },
        error: null,
      },
      {
        data: {
          id: 'handoff-1',
          job_id: 'job-2',
          manuscript_id: 91,
          artifact_type: 'pass12_handoff_v1',
          content: {
            schema_version: 'wrong_schema',
          },
        },
        error: null,
      },
    ]);

    await expect(assertPhase3UpstreamInputsCanonical(supabase, 'job-2', 91)).rejects.toThrow(
      /must be canonical and complete/i,
    );
  });

  it('accepts canonical phase_3 upstream chain for same job/manuscript', async () => {
    const supabase = makeSupabase([
      {
        data: {
          id: 'accepted-1',
          job_id: 'job-3',
          manuscript_id: 100,
          artifact_type: 'accepted_story_ledger_v1',
          content: {
            governance_rail: {
              layer_decisions: makeLayerDecisions(9),
            },
          },
        },
        error: null,
      },
      {
        data: {
          id: 'handoff-1',
          job_id: 'job-3',
          manuscript_id: 100,
          artifact_type: 'pass12_handoff_v1',
          content: {
            schema_version: 'pass12_handoff_v1',
            pass1Output: { text: 'ok' },
          },
        },
        error: null,
      },
    ]);

    await expect(assertPhase3UpstreamInputsCanonical(supabase, 'job-3', 100)).resolves.toBeUndefined();
  });
});
