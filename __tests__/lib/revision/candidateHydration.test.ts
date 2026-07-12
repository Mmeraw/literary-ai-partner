import {
  hydrateLedgerCandidates,
  HYDRATION_MAX_BATCH_SIZE,
  type HydrationOpportunity,
} from '@/lib/revision/candidateHydration';
import OpenAI from 'openai';

// ── OpenAI mock ───────────────────────────────────────────────────────────────

jest.mock('openai');

const MockOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;
let mockCreate: jest.Mock;

function getMockCreate(): jest.Mock {
  return mockCreate;
}

function makeCompletion(results: Array<{
  id: string;
  candidate_a: string;
  candidate_b: string;
  candidate_c: string;
}>) {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({ results }),
        },
      },
    ],
  };
}

// ── Test data ─────────────────────────────────────────────────────────────────

const oppA: HydrationOpportunity = {
  opportunity_id: 'rol:aaa111',
  evidence_anchor:
    'She opened the door and suddenly the chapter ended without resolution.',
  rationale: 'Abrupt scene transition weakens momentum; insert a bridging beat before cut.',
  revision_operation: 'insert_after_selected_passage',
};

const oppB: HydrationOpportunity = {
  opportunity_id: 'rol:bbb222',
  evidence_anchor:
    'The sky was blue and the grass was green and everything seemed fine.',
  rationale: 'Generic description lacks specificity; replace with manuscript-specific detail.',
  revision_operation: 'replace_selected_passage',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('hydrateLedgerCandidates', () => {
  beforeEach(() => {
    mockCreate = jest.fn();
    MockOpenAI.mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    }) as unknown as OpenAI);
  });

  it('returns empty result immediately when blocked list is empty', async () => {
    const result = await hydrateLedgerCandidates([], 'sk-test');
    expect(result.hydratedCount).toBe(0);
    expect(result.skippedCount).toBe(0);
    expect(result.candidates.size).toBe(0);
    expect(getMockCreate()).not.toHaveBeenCalled();
  });

  it('returns populated candidates when OpenAI produces valid prose', async () => {
    getMockCreate().mockResolvedValueOnce(
      makeCompletion([
        {
          id: 'rol:aaa111',
          candidate_a:
            'Mara stood in the doorway long enough to hear the radiator tick before she stepped through.',
          candidate_b:
            'The silence held for a breath, then two, before she finally crossed the threshold into the next scene.',
          candidate_c:
            'She hesitated just past the door frame, letting the weight of the moment settle before moving on.',
        },
      ]),
    );

    const result = await hydrateLedgerCandidates([oppA], 'sk-test');

    expect(result.hydratedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect(result.candidates.size).toBe(1);
    const cands = result.candidates.get('rol:aaa111')!;
    expect(cands.candidate_text_a).toMatch(/Mara/);
    expect(cands.candidate_text_b).toMatch(/silence/);
    expect(cands.candidate_text_c).toMatch(/hesitated/);
  });

  it('uses max_completion_tokens and omits temperature for gpt-5.1 hydration', async () => {
    getMockCreate().mockResolvedValueOnce(
      makeCompletion([
        {
          id: 'rol:aaa111',
          candidate_a: 'The radiator ticked twice before she gathered herself to continue.',
          candidate_b: 'Outside the door the corridor stretched on; she paused before following it.',
          candidate_c: 'She paused until her breath settled before stepping into what came next.',
        },
      ]),
    );

    await hydrateLedgerCandidates([oppA], 'sk-test');

    expect(getMockCreate()).toHaveBeenCalledTimes(1);
    const call = getMockCreate().mock.calls[0][0] as {
      model: string;
      max_completion_tokens?: number;
      max_tokens?: number;
      temperature?: number;
      response_format: { type: string };
      messages: unknown[];
    };
    expect(call.model).toBe('gpt-5.1');
    expect(call.max_completion_tokens).toBe(8000);
    expect(call.max_tokens).toBeUndefined();
    expect(call.temperature).toBeUndefined();
    expect(call.response_format).toEqual({ type: 'json_object' });
    expect(call.messages).toHaveLength(2);
  });

  it('rejects candidates shorter than 5 words and does not include that opportunity', async () => {
    getMockCreate().mockResolvedValueOnce(
      makeCompletion([
        {
          id: 'rol:bbb222',
          candidate_a: 'Too short.',           // < 5 words — SLAE fail
          candidate_b:
            'The valley beyond the pass was covered in a thick carpet of wildflowers, dew still clinging to each petal.',
          candidate_c:
            'Pockets of morning mist clung to the hillside long after the sun had climbed above the ridge line.',
        },
      ]),
    );

    const result = await hydrateLedgerCandidates([oppB], 'sk-test');

    // All three must pass; one fails → entire opportunity is not hydrated
    expect(result.hydratedCount).toBe(0);
    expect(result.candidates.has('rol:bbb222')).toBe(false);
  });

  it('rejects candidates that verbatim echo the anchor (SLAE echo check)', async () => {
    getMockCreate().mockResolvedValueOnce(
      makeCompletion([
        {
          id: 'rol:bbb222',
          // candidate_a matches anchor exactly after normalization
          candidate_a: 'The sky was blue and the grass was green and everything seemed fine.',
          candidate_b:
            'Golden afternoon light cut through the canopy, throwing dappled shadows across the meadow path.',
          candidate_c:
            'A dense stand of birch gave way to open ground where the light fell differently in every season.',
        },
      ]),
    );

    const result = await hydrateLedgerCandidates([oppB], 'sk-test');

    // candidate_a echoes anchor → all three must pass → not hydrated
    expect(result.hydratedCount).toBe(0);
    expect(result.candidates.has('rol:bbb222')).toBe(false);
  });

  it('processes both opportunities in a single batch and returns two hydrated entries', async () => {
    getMockCreate().mockResolvedValueOnce(
      makeCompletion([
        {
          id: 'rol:aaa111',
          candidate_a:
            'The radiator ticked twice in the sudden quiet before she gathered herself to continue.',
          candidate_b:
            'Outside the door the corridor stretched on; she gave herself a moment before following it.',
          candidate_c:
            'She paused long enough to hear her own breath settle before stepping into what came next.',
        },
        {
          id: 'rol:bbb222',
          candidate_a:
            'Late summer heat pressed down on the valley, turning the distant hills a pale, washed-out blue.',
          candidate_b:
            'The field beyond the fence line shimmered in the heat haze, each blade of grass bending in slow unison.',
          candidate_c:
            'A smell of cut grass and diesel drifted from the far side of the ridge on the afternoon air.',
        },
      ]),
    );

    const result = await hydrateLedgerCandidates([oppA, oppB], 'sk-test');

    expect(getMockCreate()).toHaveBeenCalledTimes(1);
    expect(result.hydratedCount).toBe(2);
    expect(result.candidates.size).toBe(2);
  });

  it('processes ALL opportunities across multiple OpenAI calls when count exceeds HYDRATION_MAX_BATCH_SIZE', async () => {
    const totalOpps = HYDRATION_MAX_BATCH_SIZE + 5;
    const lotsOfOpps: HydrationOpportunity[] = Array.from(
      { length: totalOpps },
      (_, i) => ({
        opportunity_id: `rol:opp${i}`,
        evidence_anchor: `Anchor excerpt number ${i} appears here in the manuscript text for testing.`,
        rationale: `Editorial recommendation number ${i} describes what needs to be fixed here.`,
      }),
    );

    const makeChunkCompletion = (opps: HydrationOpportunity[]) =>
      makeCompletion(
        opps.map((o) => ({
          id: o.opportunity_id,
          candidate_a: 'Mara paused at the doorway long enough for the quiet to gather around her.',
          candidate_b: 'The room changed before anyone spoke, its stillness making the choice visible.',
          candidate_c: 'A glass trembled on the table, catching the consequence in one small sound.',
        })),
      );

    const chunks: HydrationOpportunity[][] = [];
    for (let offset = 0; offset < lotsOfOpps.length; offset += HYDRATION_MAX_BATCH_SIZE) {
      chunks.push(lotsOfOpps.slice(offset, offset + HYDRATION_MAX_BATCH_SIZE));
    }

    for (const chunk of chunks) {
      getMockCreate().mockResolvedValueOnce(makeChunkCompletion(chunk));
    }

    const result = await hydrateLedgerCandidates(lotsOfOpps, 'sk-test');

    // All opportunities processed across all chunks — nothing skipped
    expect(result.skippedCount).toBe(0);
    expect(result.hydratedCount).toBe(totalOpps);
    expect(getMockCreate()).toHaveBeenCalledTimes(chunks.length);

    // First call's prompt should not contain second chunk's opportunity ids
    const firstCallArg = getMockCreate().mock.calls[0][0] as { messages: Array<{ content: string }> };
    expect(firstCallArg.messages[1].content).not.toContain(`rol:opp${HYDRATION_MAX_BATCH_SIZE}`);

    // Second call's prompt should contain the first overflow chunk
    const secondCallArg = getMockCreate().mock.calls[1][0] as { messages: Array<{ content: string }> };
    expect(secondCallArg.messages[1].content).toContain(`rol:opp${HYDRATION_MAX_BATCH_SIZE}`);
  });

  it('returns empty result and does not throw when all OpenAI calls fail', async () => {
    getMockCreate().mockRejectedValue(new Error('network error'));

    const result = await hydrateLedgerCandidates([oppA], 'sk-test');

    expect(result.hydratedCount).toBe(0);
    expect(result.candidates.size).toBe(0);
  });

  it('returns empty result when OpenAI returns malformed JSON', async () => {
    getMockCreate().mockResolvedValueOnce({
      choices: [{ message: { content: 'not json at all' } }],
    });

    const result = await hydrateLedgerCandidates([oppA], 'sk-test');

    expect(result.hydratedCount).toBe(0);
    expect(result.candidates.size).toBe(0);
  });

  it('returns empty result when OpenAI returns empty content', async () => {
    getMockCreate().mockResolvedValueOnce({
      choices: [{ message: { content: '' } }],
    });

    const result = await hydrateLedgerCandidates([oppA], 'sk-test');

    expect(result.hydratedCount).toBe(0);
    expect(result.candidates.size).toBe(0);
  });

  it('ignores result entries with unknown or mismatched ids', async () => {
    getMockCreate().mockResolvedValueOnce(
      makeCompletion([
        {
          id: 'rol:does-not-exist',
          candidate_a: 'Valid prose for an unknown opportunity identifier in the response.',
          candidate_b: 'Another valid prose candidate for the unknown opportunity identifier.',
          candidate_c: 'A third valid prose candidate for the unknown opportunity identifier here.',
        },
      ]),
    );

    const result = await hydrateLedgerCandidates([oppA], 'sk-test');

    expect(result.hydratedCount).toBe(0);
    expect(result.candidates.size).toBe(0);
  });

  it('rejects near-synonym A/B/C candidates that are not materially distinct', async () => {
    getMockCreate().mockResolvedValueOnce(
      makeCompletion([
        {
          id: 'rol:bbb222',
          candidate_a:
            'Late summer heat pressed down on the valley, turning the distant hills a pale washed-out blue.',
          candidate_b:
            'Late summer heat pressed across the valley, making the distant hills look pale and washed-out blue.',
          candidate_c:
            'The late summer heat pressed over the valley until the distant hills turned pale and washed-out blue.',
        },
      ]),
    );

    const result = await hydrateLedgerCandidates([oppB], 'sk-test');

    expect(result.hydratedCount).toBe(0);
    expect(result.candidates.has('rol:bbb222')).toBe(false);
  });

  it('rejects invented quoted dialogue in TESTIMONY mode when source excerpt has no dialogue', async () => {
    const testimonyDialogueRisk: HydrationOpportunity = {
      opportunity_id: 'rol:testimony-dialogue',
      evidence_anchor:
        'Brad, myself and others have suggested to Christine that she should just kick Nicolas out so he learns to become self-sufficient.',
      rationale: 'Convert one summarized exchange between Christine and the narrator into a short dialogue beat.',
      revision_operation: 'replace_selected_passage',
      evaluation_mode: 'TESTIMONY',
    };

    getMockCreate().mockResolvedValueOnce(
      makeCompletion([
        {
          id: 'rol:testimony-dialogue',
          candidate_a:
            'Christine folded her arms and said, “I cannot throw Nicolas out just because everyone else thinks I should.”',
          candidate_b:
            'I told Christine, “You are enabling him,” but she looked away and answered, “He is still my son.”',
          candidate_c:
            'Brad shook his head and said, “He has to learn,” while Christine stayed fixed in the doorway.',
        },
      ]),
    );

    const result = await hydrateLedgerCandidates([testimonyDialogueRisk], 'sk-test');

    expect(result.hydratedCount).toBe(0);
    expect(result.candidates.has('rol:testimony-dialogue')).toBe(false);
  });
});
