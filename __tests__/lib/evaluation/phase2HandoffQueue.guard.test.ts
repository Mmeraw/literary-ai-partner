import { assertPass12HandoffExistsBeforePhase3Queue } from '@/lib/evaluation/processor';

describe('assertPass12HandoffExistsBeforePhase3Queue', () => {
  const canonicalHandoff = {
    id: 'handoff-id',
    job_id: 'job-1',
    manuscript_id: 123,
    content: {
      schema_version: 'pass12_handoff_v1',
      pass1Output: {},
      pass2Output: {},
    },
  };

  function makeSupabase(result: { data: unknown; error: { message: string } | null }) {
    return {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => result,
            }),
          }),
        }),
      }),
    } as any;
  }

  it('passes when pass12_handoff_v1 exists and is canonical complete', async () => {
    const supabase = makeSupabase({ data: canonicalHandoff, error: null });
    await expect(assertPass12HandoffExistsBeforePhase3Queue(supabase, 'job-1', 123)).resolves.toBeUndefined();
  });

  it('fails when handoff does not exist', async () => {
    const supabase = makeSupabase({ data: null, error: null });
    await expect(assertPass12HandoffExistsBeforePhase3Queue(supabase, 'job-1')).rejects.toThrow(
      /requires pass12_handoff_v1/i,
    );
  });

  it('fails when handoff lookup errors', async () => {
    const supabase = makeSupabase({ data: null, error: { message: 'boom' } });
    await expect(assertPass12HandoffExistsBeforePhase3Queue(supabase, 'job-1')).rejects.toThrow(
      /handoff check failed/i,
    );
  });

  it('fails when handoff content is not canonical complete', async () => {
    const supabase = makeSupabase({
      data: {
        ...canonicalHandoff,
        content: {
          schema_version: 'pass12_handoff_v1',
          pass1Output: {},
        },
      },
      error: null,
    });

    await expect(assertPass12HandoffExistsBeforePhase3Queue(supabase, 'job-1', 123)).rejects.toThrow(
      /canonical complete pass12_handoff_v1/i,
    );
  });

  it('fails when handoff belongs to a different manuscript', async () => {
    const supabase = makeSupabase({ data: canonicalHandoff, error: null });

    await expect(assertPass12HandoffExistsBeforePhase3Queue(supabase, 'job-1', 999)).rejects.toThrow(
      /manuscript_id mismatch/i,
    );
  });
});
