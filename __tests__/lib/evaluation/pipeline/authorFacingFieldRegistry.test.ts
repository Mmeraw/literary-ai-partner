/**
 * Author-facing field registry invariant tests.
 *
 * Ensures every author-facing surface in SynthesisOutput / EvaluationResultV2
 * is either canonical, derived-with-provenance, optional/quarantinable, or
 * explicitly excluded. Any new author-facing field must be registered before
 * it can be normalized or repaired.
 */

import {
  CANONICAL_AUTHOR_FACING_FIELDS,
  DERIVED_AUTHOR_FACING_FIELDS,
  isKnownAuthorFacingPath,
} from '@/lib/evaluation/pipeline/authorFacingFieldRegistry';
import { repairSynthesisIntegrity } from '@/lib/evaluation/pipeline/repairSynthesisIntegrity';
import type { SynthesisOutput } from '@/lib/evaluation/pipeline/types';
import * as requiredProseRegeneration from '@/lib/evaluation/pipeline/requiredProseRegeneration';

jest.mock('@/lib/evaluation/pipeline/requiredProseRegeneration', () => ({
  ...jest.requireActual('@/lib/evaluation/pipeline/requiredProseRegeneration'),
  regenerateRequiredProse: jest.fn(),
}));

const mockedRegenerateRequiredProse = jest.mocked(
  requiredProseRegeneration.regenerateRequiredProse,
);

function makeMinimalSynthesis(): SynthesisOutput {
  return {
    criteria: [
      {
        key: 'concept',
        craft_score: 6,
        editorial_score: 6,
        final_score_0_10: 6,
        score_delta: 0,
        final_rationale: 'The concept is clearly present.',
        fit_summary: 'The premise is identifiable.',
        gap_summary: 'The central promise could be sharpened.',
        pressure_points: ['The opening hook lands cleanly.'],
        decision_points: ['The protagonist chooses to enter the salon.'],
        consequence_status: 'landed',
        evidence: [{ snippet: 'The opening paragraph.' }],
        recommendations: [
          {
            priority: 'high',
            action: 'Clarify the protagonist’s goal in the first scene.',
            expected_impact: 'Readers will latch onto the central conflict immediately.',
            anchor_snippet: 'The opening paragraph.',
            source_pass: 3,
            issue_family: 'characterization',
            strategic_lever: 'scene_goal_clarity',
            revision_granularity: 'scene',
            mechanism: 'A clear goal creates narrative momentum.',
            specific_fix: 'Add one sentence stating the protagonist wants to impress his date.',
            reader_effect: 'The reader understands what is at stake.',
            symptom: 'The opening feels observational rather than driven.',
            cause: 'No explicit goal is stated.',
            fix_direction: 'Anchor the scene around a concrete want.',
            candidate_text_a: 'Add a sentence in the first paragraph that names what the protagonist wants from the evening.',
            candidate_text_b: 'Restate the opening beat so the protagonist’s desire is unmistakable.',
            candidate_text_c: 'Reframe the first paragraph around the protagonist’s private objective.',
          },
        ],
      },
    ],
    overall: {
      overall_score_0_100: 74,
      verdict: 'revise',
      one_paragraph_summary:
        'The manuscript demonstrates a recognizable voice and scene-level pressure, though the central concept needs sharper articulation.',
      one_sentence_pitch: 'A vain protagonist learns the cost of vanity over one disastrous Saturday.',
      one_paragraph_pitch:
        'A status-conscious narrator spends a day and hundreds of dollars chasing a fashionable hairstyle, only to meet a stylist whose humility reframes his values.',
      top_3_strengths: ['Distinctive first-person voice.', 'Concrete scene details.', 'Clear emotional arc.'],
      top_3_risks: ['Concept is diffuse in the middle.', 'Some transitions feel convenient.', 'Ending rushes the emotional shift.'],
      submission_readiness: 'nearly_ready',
    },
    metadata: {
      pass1_model: 'gpt-4o',
      pass2_model: 'o3',
      pass3_model: 'o3',
      generated_at: new Date().toISOString(),
    },
    partial_evaluation: false,
  } as SynthesisOutput;
}

beforeEach(() => {
  mockedRegenerateRequiredProse.mockReset();
  mockedRegenerateRequiredProse.mockImplementation(async (_synthesis, violations) => ({
    ok: true,
    synthesis: _synthesis,
    regeneratedFields: violations.map((v) => v.path),
    failedFields: [],
    telemetry: { attempts: 1, regeneratedFields: [], failedFields: [], model: 'mock' },
  }));
});

describe('authorFacingFieldRegistry', () => {
  it('covers all canonical and derived author-facing field keys', () => {
    for (const field of CANONICAL_AUTHOR_FACING_FIELDS) {
      expect(isKnownAuthorFacingPath(`evaluation_result_v2.criteria[0].recommendations[0].${field}`)).toBe(true);
    }
    for (const field of DERIVED_AUTHOR_FACING_FIELDS) {
      expect(isKnownAuthorFacingPath(`evaluation_result_v2.recommendations.quick_wins[0].${field}`)).toBe(true);
      expect(isKnownAuthorFacingPath(`evaluation_result_v2.recommendations.strategic_revisions[0].${field}`)).toBe(true);
    }
    expect(isKnownAuthorFacingPath('evaluation_result_v2.criteria[0].evidence[0].snippet')).toBe(true);
    // `priority` is explicitly excluded from prose rewriting.
    expect(isKnownAuthorFacingPath('evaluation_result_v2.criteria[0].recommendations[0].priority')).toBe(true);
    expect(isKnownAuthorFacingPath('evaluation_result_v2.criteria[0].market_summary')).toBe(false);
  });

  it('rejects an unregistered author-facing field with a clear registry error', async () => {
    const synthesis = makeMinimalSynthesis();
    // `market_summary` matches the author-facing key pattern but is not in the registry.
    (synthesis.criteria[0] as Record<string, unknown>).market_summary =
      'The story targets a literary fiction readership';

    await expect(repairSynthesisIntegrity(synthesis, { openaiApiKey: 'test-key' })).rejects.toThrow(
      /unknown path.*market_summary.*authorFacingFieldRegistry/iu,
    );
  });

  it('accepts a fully registered author-facing projection', async () => {
    const synthesis = makeMinimalSynthesis();
    const result = await repairSynthesisIntegrity(synthesis, { openaiApiKey: 'test-key' });

    expect(result.ok).toBe(true);
    expect(result.remainingViolations).toHaveLength(0);
  });
});
