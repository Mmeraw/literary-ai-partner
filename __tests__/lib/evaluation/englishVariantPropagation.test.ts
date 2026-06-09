import OpenAI from 'openai';
import { buildPass1UserPrompt } from '@/lib/evaluation/pipeline/prompts/pass1-craft';
import { buildPass2UserPrompt } from '@/lib/evaluation/pipeline/prompts/pass2-editorial';
import { buildPass3UserPrompt } from '@/lib/evaluation/pipeline/prompts/pass3-synthesis';
import { buildPass3bUserPrompt } from '@/lib/evaluation/pipeline/prompts/pass3b-longform';
import { normalizeEnglishVariant, englishVariantLabel } from '@/lib/evaluation/englishVariant';
import { hydrateLedgerCandidates, type HydrationOpportunity } from '@/lib/revision/candidateHydration';
import { enrichDiagnosticFields, type EnrichmentOpportunity } from '@/lib/revision/diagnosticEnrichment';
import { buildPass4UserPrompt } from '@/lib/revision/prompts/pass4-voice-rewrite';
import { CRITERIA_KEYS } from '@/schemas/criteria-keys';
import type { SynthesizedCriterion } from '@/lib/evaluation/pipeline/types';

jest.mock('openai');

const MockOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;
let mockCreate: jest.Mock;
const originalOpenAiKey = process.env.OPENAI_API_KEY;

const CANADIAN_CONTRACT = 'AUTHOR-FACING LANGUAGE CONTRACT — Canadian English';
const EXACT_QUOTE = '“The color of the harbor looked wrong,” Mara said.';

function expectCanadianContract(prompt: string) {
  expect(prompt).toContain(CANADIAN_CONTRACT);
  expect(prompt).toContain('All RevisionGrade-generated author-facing output MUST use Canadian English');
  expect(prompt).toContain('NEVER alter manuscript text, quotations, excerpts, evidence snippets');
  expect(prompt).toContain('Do NOT silently fall back to American English unless Canadian English is the selected variant.');
}

function makeCriteria(): SynthesizedCriterion[] {
  return CRITERIA_KEYS.map((key) => ({
    key,
    craft_score: 7,
    editorial_score: 7,
    final_score_0_10: 7,
    score_delta: 0,
    final_rationale: `Rationale for ${key}.`,
    fit_summary: `Fit for ${key}.`,
    gap_summary: `Gap for ${key}.`,
    pressure_points: [],
    decision_points: [],
    consequence_status: 'landed',
    evidence: [{ snippet: `Evidence for ${key}.` }],
    recommendations: [],
  }));
}

describe('English variant propagation into generated output prompts', () => {
  beforeEach(() => {
    mockCreate = jest.fn();
    MockOpenAI.mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    }) as unknown as OpenAI);
    process.env.OPENAI_API_KEY = 'sk-test';
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  });

  it('normalizes and labels supported Evaluate-time variants', () => {
    expect(normalizeEnglishVariant('ca')).toBe('ca');
    expect(englishVariantLabel('ca')).toBe('Canadian English');
    expect(normalizeEnglishVariant('nonsense')).toBe('us');
    expect(englishVariantLabel('nonsense')).toBe('American English');
  });

  it('injects Canadian English into Pass 1 without altering quoted manuscript text', () => {
    const prompt = buildPass1UserPrompt({
      manuscriptText: EXACT_QUOTE,
      workType: 'novel',
      title: 'Harbour Test',
      englishVariant: 'ca',
    });

    expectCanadianContract(prompt);
    expect(prompt).toContain(EXACT_QUOTE);
  });

  it('injects Canadian English into Pass 2 without altering quoted manuscript text', () => {
    const prompt = buildPass2UserPrompt({
      manuscriptText: EXACT_QUOTE,
      workType: 'novel',
      title: 'Harbour Test',
      englishVariant: 'ca',
    });

    expectCanadianContract(prompt);
    expect(prompt).toContain(EXACT_QUOTE);
  });

  it('injects Canadian English into Pass 3 synthesis without altering quoted manuscript text', () => {
    const prompt = buildPass3UserPrompt({
      comparisonPacketJson: JSON.stringify({ quote: EXACT_QUOTE }),
      pass2aStructuredContext: {
        character_ledger: [],
        scene_index: [],
        timeline_anchors: [],
      },
      manuscriptText: EXACT_QUOTE,
      title: 'Harbour Test',
      englishVariant: 'ca',
    });

    expectCanadianContract(prompt);
    expect(prompt).toContain(EXACT_QUOTE);
  });

  it('injects Canadian English into Pass 3B/DREAM prompt without altering quoted manuscript samples', () => {
    const prompt = buildPass3bUserPrompt({
      title: 'Harbour Test',
      wordCount: 90000,
      chapterCount: 30,
      workType: 'novel',
      criteria: makeCriteria(),
      pass2aStructuredContext: {
        character_ledger: [],
        scene_index: [],
        timeline_anchors: [],
      },
      chunkSample: [{ chunk_index: 0, content: EXACT_QUOTE }],
      englishVariant: 'ca',
    });

    expectCanadianContract(prompt);
    expect(prompt).toContain(EXACT_QUOTE);
  });

  it('injects Canadian English into Revise Queue candidate hydration prompts', async () => {
    const opportunity: HydrationOpportunity = {
      opportunity_id: 'rol:canadian001',
      evidence_anchor: EXACT_QUOTE,
      rationale: 'The scene needs a concrete bridge beat before the emotional turn.',
      revision_operation: 'insert_after_selected_passage',
      english_variant: 'ca',
      manuscript_context: EXACT_QUOTE,
    };
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            results: [{
              id: 'rol:canadian001',
              candidate_a: 'Mara waited by the rain-streaked window until the harbour lights steadied in the glass.',
              candidate_b: 'She kept one hand on the sill, listening as the gulls thinned into the afternoon fog.',
              candidate_c: 'For a breath, she let the cold off the water settle before she answered him.',
            }],
          }),
        },
      }],
    });

    await hydrateLedgerCandidates([opportunity], 'sk-test');

    const userMessage = mockCreate.mock.calls[0][0].messages.find((m: { role: string }) => m.role === 'user').content;
    expectCanadianContract(userMessage);
    expect(userMessage).toContain(JSON.stringify(EXACT_QUOTE));
  });

  it('injects Canadian English into Revise Queue diagnostic enrichment prompts', async () => {
    const opportunity: EnrichmentOpportunity = {
      opportunity_id: 'rol:diagnostic001',
      evidence_anchor: EXACT_QUOTE,
      rationale: 'The passage states the emotional turn before staging the sensory cause.',
      criterion: 'emotional_arc',
      revision_operation: 'replace_selected_passage',
      english_variant: 'ca',
    };
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            symptom: 'The scene names the emotional pressure before the reader has enough staged sensory evidence to feel it.',
            cause: 'The paragraph relies on summary timing instead of placing a concrete beat between perception and response.',
            fix_direction: 'Stage one specific physical or sensory beat before the line of interpretation so the turn lands on the page.',
            reader_effect: 'The reader experiences the emotional shift through observed action rather than accepting it as editorial explanation.',
          }),
        },
      }],
    });

    await enrichDiagnosticFields([opportunity]);

    const userMessage = mockCreate.mock.calls[0][0].messages[0].content;
    expectCanadianContract(userMessage);
    expect(userMessage).toContain(`"${EXACT_QUOTE}"`);
  });

  it('injects Canadian English into TrustedPath/Pass 4 rewrite prompts', () => {
    const prompt = buildPass4UserPrompt({
      originalPassage: EXACT_QUOTE,
      englishVariant: 'ca',
      editorialInstruction: 'Revise the passage to stage the emotional turn more concretely.',
      symptom: 'The emotion is summarised before it is embodied.',
      cause: 'The passage skips the sensory beat that would ground the feeling.',
      mistakeProofing: 'Preserve names and factual sequence exactly.',
      operation: 'replace',
      voiceContext: `Before: ${EXACT_QUOTE}\nAfter: Mara closed the door.`,
      location: 'Chapter 4',
      trustedPathOnly: true,
    });

    expectCanadianContract(prompt);
    expect(prompt).toContain(EXACT_QUOTE);
    expect(prompt).toContain('Produce ONE manuscript-ready variant');
  });
});
