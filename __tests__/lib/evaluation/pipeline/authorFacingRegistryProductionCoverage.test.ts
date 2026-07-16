import { CRITERIA_KEYS } from '@/schemas/criteria-keys';
import { synthesisToEvaluationResultV2 } from '@/lib/evaluation/pipeline/runPipeline';
import type { SynthesisOutput } from '@/lib/evaluation/pipeline/types';
import { findMatchingAuthorFacingContracts } from '@/lib/text/authorFacingProseAuthority';
import { isAuthorTextPath, isExcludedPath } from '@/lib/text/authorFacingIntegrity';

const NON_CENTRAL_AUTHOR_TEXT_PATHS: readonly RegExp[] = [
  /^evaluation_result_v2\.criteria\[\d+\]\.signal_strength$/u,
  /^evaluation_result_v2\.(?:detected_mode|metrics|enrichment|governance|artifacts)\./u,
] as const;

function createProductionShapeSynthesis(): SynthesisOutput {
  return {
    criteria: CRITERIA_KEYS.map((key, criterionIndex) => ({
      key,
      craft_score: 7,
      editorial_score: 7,
      final_score_0_10: 7,
      score_delta: 0,
      final_rationale:
        'The criterion is functioning, but targeted revision would make the effect more precise and consistent.',
      fit_summary: 'The manuscript demonstrates a clear foundation in this area.',
      gap_summary: 'The remaining gap is consistency across the full manuscript.',
      pressure_points: ['Narrative pressure accumulates around this criterion.'],
      decision_points: ['The manuscript makes a visible decision at this point.'],
      consequence_status: 'landed' as const,
      evidence: [{ snippet: `Evidence passage ${criterionIndex}.` }],
      recommendations: [
        {
          priority: 'medium' as const,
          action: 'Clarify the targeted passage so the intended effect is immediately legible.',
          expected_impact: 'The revision will make the intended effect clearer to the reader.',
          reader_effect: 'Greater clarity and confidence in the scene',
          anchor_snippet: `Evidence passage ${criterionIndex}.`,
          source_pass: 2 as const,
          issue_family: 'scene_structure' as const,
          strategic_lever: 'scene_goal_clarity' as const,
          revision_granularity: 'scene' as const,
          mechanism: 'Clarifies the causal relationship between action and consequence',
          specific_fix: 'Add one concrete action beat before the response',
          symptom: 'The transition currently feels abrupt.',
          cause: 'The causal link is implied rather than dramatized.',
          rationale: 'The recommendation protects the existing tone while improving clarity',
          fix_direction: 'Make the causal transition explicit without adding exposition.',
          mistake_proofing: 'Preserve the existing voice and pacing',
          candidate_text_a: 'The character pauses, then answers with a clearer sense of consequence.',
          candidate_text_b: 'After a brief pause, the character answers and reveals the consequence.',
          candidate_text_c: 'The answer lands only after the character recognizes what has changed.',
        },
      ],
      technical_defects: [
        {
          code: 'RECOMMENDATION_TRUNCATED' as const,
          author_facing_reason:
            'One recommendation was incomplete and required regeneration before certification.',
          retryable: true,
        },
      ],
    })),
    overall: {
      overall_score_0_100: 70,
      verdict: 'revise' as const,
      one_sentence_pitch: 'A promising manuscript needs focused revision before submission.',
      one_paragraph_pitch:
        'A promising manuscript combines a clear dramatic premise with targeted opportunities for stronger execution.',
      one_paragraph_summary:
        'The manuscript has a solid foundation, but focused revision is required to improve clarity, momentum, and consistency.',
      top_3_strengths: [
        'The manuscript has a clear dramatic premise.',
        'The central voice remains consistent.',
        'The structure supports the intended reader experience.',
      ],
      top_3_risks: [
        'Several transitions remain underdeveloped.',
        'Some recommendations require more precise execution.',
        'The ending needs a stronger sense of consequence.',
      ],
      submission_readiness: 'nearly_ready' as const,
    },
    metadata: {
      pass1_model: 'test-model',
      pass2_model: 'test-model',
      pass3_model: 'test-model',
      generated_at: '2026-07-15T00:00:00.000Z',
    },
    partial_evaluation: false,
  };
}

function discoverHeuristicAuthorTextPaths(
  value: unknown,
  rootPath = 'evaluation_result_v2',
): string[] {
  const paths: string[] = [];

  function visit(current: unknown, path: string): void {
    if (current === null || current === undefined) return;
    if (typeof current === 'string') {
      if (current.trim() && !isExcludedPath(path) && isAuthorTextPath(path)) {
        paths.push(path);
      }
      return;
    }
    if (typeof current !== 'object') return;
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    Object.entries(current as Record<string, unknown>).forEach(([key, child]) => {
      visit(child, `${path}.${key}`);
    });
  }

  visit(value, rootPath);
  return [...new Set(paths)];
}

function countNonCentralDispositions(path: string): number {
  return NON_CENTRAL_AUTHOR_TEXT_PATHS.filter((pattern) => pattern.test(path)).length;
}

describe('production EvaluationResultV2 author-facing registry coverage', () => {
  it('assigns every discovered production surface exactly one ownership disposition', () => {
    const result = synthesisToEvaluationResultV2({
      synthesis: createProductionShapeSynthesis(),
      title: 'Registry Coverage Manuscript',
      manuscriptText:
        'A complete manuscript passage provides enough context for production projection and certification coverage.',
      ids: {
        evaluation_run_id: 'registry-coverage-run',
        manuscript_id: 9999,
        user_id: 'registry-coverage-user',
      },
      llmEnrichment: {
        premise: 'A character must decide whether clarity is worth the cost of change.',
        diagnosed_genre: 'literary fiction',
        target_audience: 'adult literary readers',
      },
    });

    const discoveredPaths = discoverHeuristicAuthorTextPaths(result);
    expect(discoveredPaths.length).toBeGreaterThan(0);

    for (const path of discoveredPaths) {
      const centralMatches = findMatchingAuthorFacingContracts(path).length;
      const nonCentralMatches = countNonCentralDispositions(path);
      expect(centralMatches + nonCentralMatches).toBe(1);
    }

    expect(
      findMatchingAuthorFacingContracts(
        'evaluation_result_v2.criteria[0].recommendations[0].rationale',
      ),
    ).toHaveLength(1);
    expect(
      findMatchingAuthorFacingContracts(
        'evaluation_result_v2.criteria[2].technical_defects[0].author_facing_reason',
      ),
    ).toHaveLength(1);
  });
});
