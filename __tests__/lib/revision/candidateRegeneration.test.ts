import {
  regenerateCandidatesForQualityFailed,
  regenerateUntilAdmitted,
} from '../../../lib/revision/candidateRegeneration';
import { hydrateLedgerCandidates } from '../../../lib/revision/candidateHydration';

jest.mock('../../../lib/revision/candidateHydration', () => ({
  hydrateLedgerCandidates: jest.fn(),
  HYDRATION_MAX_BATCH_SIZE: 3,
  HYDRATION_MODEL: 'gpt-5.1',
  HYDRATION_PROMPT_VERSION: 'candidate_hydration_v2_premium_prose',
}));

const mockHydrate = hydrateLedgerCandidates as jest.MockedFunction<typeof hydrateLedgerCandidates>;

const base = {
  opportunity_id: 'op-1',
  grounding_status: 'supported',
  preflight_status: 'passed',
  context_quality: 'clean',
  candidate_text_a: 'The silence stretched.',
  candidate_text_b: 'The air grew heavy.',
  candidate_text_c: 'Something shifted.',
};

const ANCHOR =
  'Mara held the door open a moment longer than she needed to, letting the silence make its own argument.';
const RATIONALE =
  'The transition lacks a causal hinge; insert a beat that shows Mara registering the implication.';

function makeOpp(id: string) {
  return {
    opportunity_id: id,
    evidence_anchor: ANCHOR,
    rationale: RATIONALE,
    revision_operation: 'insert_after_selected_passage' as const,
    evaluation_mode: 'STANDARD',
    manuscript_context: `Local context: ${ANCHOR}`,
  };
}

function goodCandidates(id: string) {
  return {
    candidate_text_a: `Mara pressed her fingertips against the doorframe before she let herself follow ${id.slice(-3)}.`,
    candidate_text_b: 'The door swung shut and she stood until her pulse registered what the silence had already decided.',
    candidate_text_c: 'Mara let the quiet collect in the room before she moved toward the next thing.',
  };
}

describe('candidateRegeneration admission helper', () => {
  it('regenerates bad candidates and admits passing replacements', async () => {
    const result = await regenerateUntilAdmitted(base as any, async () => ({
      candidate_text_a: 'He kept one hand on the doorframe and listened for her answer.',
      candidate_text_b: 'He stayed beside the door, counting the seconds until she moved.',
      candidate_text_c: 'He lowered his voice before he asked again.',
    }));
    expect(result.admitted).toBe(true);
    expect(result.attempts).toBe(1);
  });

  it('withholds after maximum failed regeneration attempts', async () => {
    const result = await regenerateUntilAdmitted(base as any, async () => ({
      candidate_text_a: 'The silence stretched.',
      candidate_text_b: 'The air grew heavy.',
      candidate_text_c: 'Something shifted.',
    }));
    expect(result.admitted).toBe(false);
    expect(result.attempts).toBe(2);
    expect(result.reasons).toContain('CANDIDATE_QUALITY_FAILED_AFTER_REGENERATION');
  });
});

describe('regenerateCandidatesForQualityFailed ledger helper', () => {
  beforeEach(() => {
    mockHydrate.mockReset();
  });

  it('returns empty healed/stillFailed maps for empty input', async () => {
    const result = await regenerateCandidatesForQualityFailed([], 'sk-test');
    expect(result.healed.size).toBe(0);
    expect(result.stillFailed.size).toBe(0);
    expect(mockHydrate).not.toHaveBeenCalled();
  });

  it('marks all as failed when api key is blank', async () => {
    const opps = [makeOpp('rol:abc'), makeOpp('rol:def')];
    const result = await regenerateCandidatesForQualityFailed(opps, '   ');
    expect(result.healed.size).toBe(0);
    expect(result.stillFailed.size).toBe(2);
    for (const reasons of result.stillFailed.values()) {
      expect(reasons).toContain('candidate_quality_failed_after_regen');
    }
    expect(mockHydrate).not.toHaveBeenCalled();
  });

  it('heals an opportunity when regenerated prose passes quality', async () => {
    const opp = makeOpp('rol:heal-me');
    mockHydrate.mockResolvedValueOnce({
      hydratedCount: 1,
      skippedCount: 0,
      candidates: new Map([['rol:heal-me', goodCandidates('rol:heal-me')]]),
    });

    const result = await regenerateCandidatesForQualityFailed([opp], 'sk-test');

    expect(result.healed.has('rol:heal-me')).toBe(true);
    expect(result.stillFailed.has('rol:heal-me')).toBe(false);
    const healed = result.healed.get('rol:heal-me')!;
    expect(healed.candidate_text_a.length).toBeGreaterThan(10);
    expect(healed.candidate_text_b.length).toBeGreaterThan(10);
    expect(healed.candidate_text_c.length).toBeGreaterThan(10);
  });

  it('fails closed when hydration succeeds but prose still fails quality', async () => {
    const opp = makeOpp('rol:still-bad');
    mockHydrate.mockResolvedValueOnce({
      hydratedCount: 1,
      skippedCount: 0,
      candidates: new Map([
        [
          'rol:still-bad',
          {
            candidate_text_a: 'This passage should be revised to clarify the narrative arc for the reader.',
            candidate_text_b: 'The scene needs to strengthen the thematic stakes for a better manuscript impact.',
            candidate_text_c: 'Consider rewriting this section to improve the transition and narrative flow.',
          },
        ],
      ]),
    });

    const result = await regenerateCandidatesForQualityFailed([opp], 'sk-test');

    expect(result.healed.has('rol:still-bad')).toBe(false);
    expect(result.stillFailed.has('rol:still-bad')).toBe(true);
    expect(result.stillFailed.get('rol:still-bad')).toContain('candidate_quality_failed_after_regen');
  });

  it('fails closed when hydration returns no candidates for the opportunity', async () => {
    const opp = makeOpp('rol:no-match');
    mockHydrate.mockResolvedValueOnce({
      hydratedCount: 0,
      skippedCount: 0,
      candidates: new Map(),
    });

    const result = await regenerateCandidatesForQualityFailed([opp], 'sk-test');

    expect(result.healed.has('rol:no-match')).toBe(false);
    expect(result.stillFailed.has('rol:no-match')).toBe(true);
    expect(result.stillFailed.get('rol:no-match')).toContain('candidate_quality_failed_after_regen');
  });

  it('fails closed when hydration call throws', async () => {
    const opp = makeOpp('rol:throw-me');
    mockHydrate.mockRejectedValueOnce(new Error('OpenAI timeout'));

    const result = await regenerateCandidatesForQualityFailed([opp], 'sk-test');

    expect(result.healed.has('rol:throw-me')).toBe(false);
    expect(result.stillFailed.has('rol:throw-me')).toBe(true);
    expect(result.stillFailed.get('rol:throw-me')).toContain('candidate_quality_failed_after_regen');
  });

  it('handles mixed batch: some heal, some remain failed', async () => {
    const oppA = makeOpp('rol:heal-a');
    const oppB = makeOpp('rol:fail-b');

    mockHydrate.mockResolvedValueOnce({
      hydratedCount: 1,
      skippedCount: 0,
      candidates: new Map([
        ['rol:heal-a', goodCandidates('rol:heal-a')],
        [
          'rol:fail-b',
          {
            candidate_text_a: 'This passage needs narrative revision to improve reader clarity.',
            candidate_text_b: 'The scene should be rewritten to strengthen thematic stakes.',
            candidate_text_c: 'Consider revising the manuscript section for better coherence.',
          },
        ],
      ]),
    });

    const result = await regenerateCandidatesForQualityFailed([oppA, oppB], 'sk-test');

    expect(result.healed.has('rol:heal-a')).toBe(true);
    expect(result.stillFailed.has('rol:fail-b')).toBe(true);
  });

  it('calls hydrateLedgerCandidates exactly once', async () => {
    const opps = [makeOpp('rol:one'), makeOpp('rol:two')];
    mockHydrate.mockResolvedValueOnce({
      hydratedCount: 0,
      skippedCount: 0,
      candidates: new Map(),
    });

    await regenerateCandidatesForQualityFailed(opps, 'sk-test');

    expect(mockHydrate).toHaveBeenCalledTimes(1);
  });
});
