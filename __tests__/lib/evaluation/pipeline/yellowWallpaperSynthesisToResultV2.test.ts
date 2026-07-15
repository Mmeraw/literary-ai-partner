/**
 * Yellow Wallpaper end-to-end projection test.
 *
 * Reproduces the exact production failure topology where
 * `evaluation_result_v2.recommendations.strategic_revisions[0].why` was invalid,
 * proves `repairSynthesisIntegrity` maps it back to the canonical source,
 * regenerates it, and then `synthesisToEvaluationResultV2` produces a clean
 * EvaluationResultV2 with no author-facing integrity violations.
 */

import { CRITERIA_KEYS } from '@/schemas/criteria-keys';
import { synthesisToEvaluationResultV2 } from '@/lib/evaluation/pipeline/runPipeline';
import { repairSynthesisIntegrity } from '@/lib/evaluation/pipeline/repairSynthesisIntegrity';
import { inspectAuthorFacingIntegrity } from '@/lib/text/authorFacingIntegrity';
import { normalizeArtifact } from '@/lib/evaluation/pipeline/normalizeArtifact';
import { buildEnrichedActionItems } from '@/lib/evaluation/actionItemQualityGate';
import type { SynthesisOutput } from '@/lib/evaluation/pipeline/types';
import type { CriterionKey } from '@/lib/evaluation/pipeline/perplexityCrossCheck';
import * as requiredProseRegeneration from '@/lib/evaluation/pipeline/requiredProseRegeneration';

jest.mock('@/lib/evaluation/pipeline/requiredProseRegeneration', () => ({
  ...jest.requireActual('@/lib/evaluation/pipeline/requiredProseRegeneration'),
  regenerateRequiredProse: jest.fn(),
}));

const mockedRegenerateRequiredProse = jest.mocked(
  requiredProseRegeneration.regenerateRequiredProse,
);

function makeYellowWallpaperSynthesis(): SynthesisOutput {
  return {
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      craft_score: 7,
      editorial_score: 6,
      final_score_0_10: 7,
      score_delta: 1,
      final_rationale:
        'Synthesized analysis: the manuscript shows functional craft execution, but the evaluation still identifies concrete revision leverage.',
      pressure_points: ['Narrative pressure accumulates around this criterion.'],
      decision_points: ['The chapter makes a concrete decision at this criterion.'],
      consequence_status: 'landed' as const,
      evidence: [{ snippet: 'The river moved slowly.' }],
      recommendations: [
        {
          priority: 'medium' as const,
          action: 'Clarify the speaker attribution in the dialogue exchange so each voice is distinct.',
          expected_impact:
            'The attribution gap causes speaker intent to blur, reducing tension in the exchange',
          reader_effect:
            'The attribution gap causes speaker intent to blur, reducing tension in the exchange',
          anchor_snippet: 'The river moved slowly through the valley.',
          source_pass: 2 as const,
          issue_family: 'scene_structure',
          strategic_lever: 'scene_goal_clarity',
          revision_granularity: 'scene',
          mechanism: 'The same attribution tag on both sides flattens the conflict into a single voice.',
          specific_fix: 'Give each speaker a distinct action beat before replying.',
          symptom: 'The dialogue feels flat because speakers are not distinct.',
          cause: 'Attribution tags are uniform and lack action beats.',
          fix_direction: 'Vary attribution and add action beats.',
          candidate_text_a: '“I am not going out,” I said, “and I am not going out at all.”',
          candidate_text_b: '“I am not going out,” I said without looking up.',
          candidate_text_c: 'I shook my head. “I am not going out.”',
        },
      ],
    })),
    overall: {
      overall_score_0_100: 70,
      verdict: 'revise' as const,
      one_sentence_pitch: 'A voice-driven literary manuscript needs targeted revision.',
      one_paragraph_pitch: 'A voice-driven literary manuscript uses river imagery and reflective narration.',
      one_paragraph_summary: 'Strong premise and voice carry the manuscript (70/100), but the draft needs targeted revision before submission.',
      top_3_strengths: ['Voice.', 'Imagery.', 'Structure.'],
      top_3_risks: ['Pacing.', 'Character.', 'Closure.'],
      submission_readiness: 'nearly_ready',
    },
    metadata: {
      pass1_model: 'gpt-4o-mini',
      pass2_model: 'gpt-4o-mini',
      pass3_model: 'gpt-4o-mini',
      generated_at: new Date().toISOString(),
    },
    partial_evaluation: false,
  } as SynthesisOutput;
}

beforeEach(() => {
  mockedRegenerateRequiredProse.mockReset();
  mockedRegenerateRequiredProse.mockImplementation(async (synthesis, violations) => {
    for (const v of violations) {
      const field = v.path.replace(/.*\.(?=[^.]+$)/u, '');
      const replacement =
        field === 'expected_impact'
          ? 'The attribution gap causes speaker intent to blur, reducing tension in the exchange.'
          : 'Revise the targeted passage so the craft signal lands clearly for the reader.';
      const normalizedPath = v.path.replace(/^evaluation_result_v2\./u, '');
      const parts = normalizedPath.split('.');
      let current: unknown = synthesis;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i]!;
        const arrayMatch = part.match(/^([^\[]+)\[(\d+)\]$/u);
        if (arrayMatch) {
          const key = arrayMatch[1]!;
          const index = parseInt(arrayMatch[2]!, 10);
          current = (current as Record<string, unknown>)[key];
          if (!Array.isArray(current)) throw new Error('Invalid path');
          current = current[index];
        } else {
          current = (current as Record<string, unknown>)[part];
        }
        if (current === undefined || current === null) throw new Error('Invalid path');
      }
      const last = parts[parts.length - 1]!;
      const lastArrayMatch = last.match(/^([^\[]+)\[(\d+)\]$/u);
      if (lastArrayMatch) {
        const key = lastArrayMatch[1]!;
        const index = parseInt(lastArrayMatch[2]!, 10);
        const arr = (current as Record<string, unknown>)[key];
        if (!Array.isArray(arr)) throw new Error('Invalid path');
        arr[index] = replacement;
      } else {
        (current as Record<string, unknown>)[last] = replacement;
      }
    }
    return {
      ok: true,
      synthesis,
      regeneratedFields: violations.map((v) => v.path),
      failedFields: [],
      telemetry: { attempts: 1, regeneratedFields: [], failedFields: [], model: 'mock' },
    };
  });
});

describe('Yellow Wallpaper synthesisToEvaluationResultV2 E2E', () => {
  it('repairs the derived why via its canonical source and produces a clean EvaluationResultV2', async () => {
    const synthesis = makeYellowWallpaperSynthesis();

    const repairResult = await repairSynthesisIntegrity(synthesis, { openaiApiKey: 'test-key' });
    expect(repairResult.ok).toBe(true);
    expect(repairResult.regeneratedFields).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/evaluation_result_v2\.criteria\[\d+\]\.recommendations\[0\]\.expected_impact/u),
      ]),
    );

    const result = synthesisToEvaluationResultV2({
      synthesis,
      title: 'The Yellow Wallpaper',
      manuscriptText:
        'It is very seldom that mere ordinary people like John and myself secure ancestral halls for the summer. A colonial mansion, a hereditary estate, I would say a haunted house, and reach the height of romantic felicity—but that would be asking too much of fate! Still I will proudly declare that there is something queer about it. Else, why should it be let so cheaply? And why have stood so long untenanted? John laughs at me, of course, but one expects that in marriage. John is practical in the extreme. He has no patience with faith, an intense horror of superstition, and he scoffs openly at any talk of things not to be felt and seen and put down in figures.',
      ids: {
        evaluation_run_id: 'run-yellow-wallpaper-e2e',
        manuscript_id: 7511,
        user_id: 'user-yellow-wallpaper',
      },
      llmEnrichment: {
        premise: 'A woman is confined to a room with yellow wallpaper.',
        diagnosed_genre: 'literary fiction',
        target_audience: 'adult literary fiction readers',
      },
    });

    // Internal provenance must be stripped before serialization.
    for (const item of result.recommendations.quick_wins) {
      expect(item).not.toHaveProperty('_provenance');
      expect(item).not.toHaveProperty('_sortScore');
    }
    for (const item of result.recommendations.strategic_revisions) {
      expect(item).not.toHaveProperty('_provenance');
      expect(item).not.toHaveProperty('_sortScore');
    }

    // Rebuild the projection one more time and validate.
    const quickWins = buildEnrichedActionItems(
      synthesis.criteria.map((c) => ({ key: c.key, recommendations: c.recommendations })),
      'high',
      5,
    );
    const strategicRevisions = buildEnrichedActionItems(
      synthesis.criteria.map((c) => ({ key: c.key, recommendations: c.recommendations })),
      'medium',
      5,
    );
    normalizeArtifact(synthesis, quickWins, strategicRevisions);
    const projectionViolations = inspectAuthorFacingIntegrity(
      {
        overview: synthesis.overall,
        criteria: synthesis.criteria,
        recommendations: { quick_wins: quickWins, strategic_revisions: strategicRevisions },
      },
      { rootPath: 'evaluation_result_v2' },
    );
    expect(projectionViolations).toHaveLength(0);

    // The strategic_revisions[0].why derived from the repaired expected_impact must be complete.
    expect(result.recommendations.strategic_revisions[0].why).toMatch(/[.!?]["'"’)\]]*$/u);
  });
});
