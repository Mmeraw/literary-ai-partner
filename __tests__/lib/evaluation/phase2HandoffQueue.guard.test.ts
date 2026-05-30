import { assertPass12HandoffExistsBeforePhase3Queue } from '@/lib/evaluation/processor';

describe('assertPass12HandoffExistsBeforePhase3Queue', () => {
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

  it('passes when pass12_handoff_v1 exists', async () => {
    const supabase = makeSupabase({ data: { id: 'handoff-id' }, error: null });
    await expect(assertPass12HandoffExistsBeforePhase3Queue(supabase, 'job-1')).resolves.toBeUndefined();
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
});
