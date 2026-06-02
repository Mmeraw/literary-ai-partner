import { describe, expect, it } from '@jest/globals';
import { CRITERIA_KEYS } from '@/schemas/criteria-keys';
import type { EvaluationResultV2 } from '@/schemas/evaluation-result-v2';
import {
  buildCoverageLimitedSummary,
  computeManuscriptCertification,
  criterionClaimScope,
  downgradeCriterionForUncertifiedLongForm,
} from '@/lib/evaluation/signal/manuscriptClaimPolicy';
import { SCOPE_POLICY_VERSION } from '@/lib/evaluation/signal/scopePolicy';
import { validateEvaluationArtifact } from '@/lib/evaluation/validateEvaluationArtifact';
import { runQualityGateV2 } from '@/lib/evaluation/pipeline/qualityGate';
import {
  classifySubmissionScope,
  type SubmissionScopeProfile,
} from '@/lib/evaluation/pipeline/submissionScope';

/**
 * Ancient Bloodlines governance regression guard.
 *
 * This file is NOT the Ancient Bloodlines gold-standard evaluation, not the
 * long-form layered template authority, and not a benchmark answer key.
 * It exists to keep historical governance failures from returning:
 *
 * - sampled / partial long-form coverage must not claim manuscript-wide scoring;
 * - stale artifacts that label incomplete coverage as SCORABLE must fail closed;
 * - deterministic downgrade must convert unsupported manuscript-wide claims to
 *   INSUFFICIENT_SIGNAL before persistence.
 *
 * Template and gold-standard shape checks live in:
 * - tests/evaluation/benchmarks/ancient-bloodlines.longform.layered.spec.ts
 * - docs/governance/evaluation-output-mode-contract.md
 */

const ANCIENT_BLOODLINES_WORD_COUNT = 18268;
const ANCIENT_BLOODLINES_CHAR_COUNT = 105000;
const SAMPLED_WORD_COUNT = 6263;
const SAMPLED_CHAR_COUNT = 42000;

function makeWordText(wordCount: number): string {
  return Array.from({ length: wordCount }, (_, index) => `word${index}`).join(' ');
}

function makeValidArtifactV2(): EvaluationResultV2 {
  return {
    schema_version: 'evaluation_result_v2',
    ids: {
      evaluation_run_id: 'ancient-bloodlines-governance-run',
      job_id: '3463bb26-0b94-41f0-bd51-07ebf89c0947',
      manuscript_id: 3463,
      user_id: '00000000-0000-0000-0000-000000000346',
    },
    generated_at: new Date().toISOString(),
    engine: {
      model: 'gpt-5.3-codex',
      provider: 'openai',
      prompt_version: 'ancient-bloodlines-benchmark-governance-regression',
    },
    overview: {
      verdict: 'revise',
      overall_score_0_100: 66,
      scored_criteria_count: CRITERIA_KEYS.length,
      one_paragraph_summary:
        'Strong thematic intelligence and world logic with identifiable craft liabilities requiring revision.',
      top_3_strengths: ['Theme intelligence', 'World-building logic', 'Core premise'],
      top_3_risks: ['Dialogue didacticism', 'Pacing drag', 'Tone wobble'],
    },
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      scorable: true,
      status: 'SCORABLE' as const,
      signal_present: true,
      signal_strength: 'SUFFICIENT' as const,
      confidence_band: 'MEDIUM' as const,
      score_0_10: 6,
      rationale: `Criterion ${key} has evidence-backed local and manuscript-level support.`,
      evidence: [{ snippet: `Evidence snippet for ${key}` }],
      recommendations: [
        {
          priority: 'medium' as const,
          action: `Revise ${key} with action-oriented scene pressure.`,
          expected_impact: 'Improves reader clarity and narrative trust.',
        },
      ],
    })),
    recommendations: {
      quick_wins: [
        {
          action: 'Trim lore-heavy interruptions in pressure scenes.',
          why: 'Preserves momentum and improves readability.',
          effort: 'low',
          impact: 'high',
        },
      ],
      strategic_revisions: [
        {
          action: 'Separate craft execution and systemic intelligence commentary in pass synthesis.',
          why: 'Prevents rubric collapse across distinct quality dimensions.',
          effort: 'medium',
          impact: 'high',
        },
      ],
    },
    metrics: {
      manuscript: {
        title: 'Ancient Bloodlines—Love Between Species',
        word_count: ANCIENT_BLOODLINES_WORD_COUNT,
      },
      processing: {
        segment_count: 13,
      },
    },
    artifacts: [],
    governance: {
      confidence: 0.72,
      warnings: [],
      limitations: [],
      policy_family: 'multi-pass-dual-axis',
      transparency: {
        evaluation_scope: {
          route: 'LONG_FORM',
          input_scale: 'full_manuscript',
          manuscript_wide_certifiable: true,
          reason_codes: [],
          criterion_scope_policy_version: SCOPE_POLICY_VERSION,
        },
        coverage_summary: {
          partial_evaluation: false,
          sampling_strategy: 'full_chunk_map_reduce',
          source_word_count: ANCIENT_BLOODLINES_WORD_COUNT,
          analyzed_word_count: ANCIENT_BLOODLINES_WORD_COUNT,
          source_char_count: ANCIENT_BLOODLINES_CHAR_COUNT,
          analyzed_char_count: ANCIENT_BLOODLINES_CHAR_COUNT,
        },
      },
    },
  };
}

function makeArtificialFullManuscriptScopeProfile(): SubmissionScopeProfile {
  return {
    inputScale: 'full_manuscript',
    wordCount: ANCIENT_BLOODLINES_WORD_COUNT,
    chunkCount: 13,
    scorableCount: CRITERIA_KEYS.length,
    confidenceCapSummary: 'HIGH',
    scopePolicyVersion: SCOPE_POLICY_VERSION,
  };
}

describe('Ancient Bloodlines — Governance behavior benchmark', () => {
  it('documents the current natural scope for the historical 18k-word fixture', () => {
    const scope = classifySubmissionScope(makeWordText(ANCIENT_BLOODLINES_WORD_COUNT), 13, 'standalone');

    expect(scope.inputScale).toBe('novelette');
    expect(scope.scopePolicyVersion).toBe('v3-mode-aware');
    expect(scope.wordCount).toBe(ANCIENT_BLOODLINES_WORD_COUNT);
  });

  it('computes certification from coverage inputs (not manual flags)', () => {
    const decision = computeManuscriptCertification({
      inputScale: 'full_manuscript',
      partialEvaluation: true,
      coverageScope: {
        sourceChars: ANCIENT_BLOODLINES_CHAR_COUNT,
        sourceWords: ANCIENT_BLOODLINES_WORD_COUNT,
        analyzedChars: SAMPLED_CHAR_COUNT,
        analyzedWords: SAMPLED_WORD_COUNT,
        strategy: 'sampled_beginning_middle_end',
      },
      hasSynthesisCriteria: true,
    });

    expect(decision.route).toBe('LONG_FORM');
    expect(decision.manuscriptWideCertifiable).toBe(false);
    expect(decision.reasonCodes).toEqual(
      expect.arrayContaining([
        'LONG_FORM_SAMPLED_COVERAGE',
        'LONG_FORM_INCOMPLETE_WORD_COVERAGE',
        'LONG_FORM_INCOMPLETE_CHAR_COVERAGE',
        'LONG_FORM_PARTIAL_EVALUATION',
      ])
    );
  });

  it('locks criterion scope policy to MANUSCRIPT_WIDE for artificial full_manuscript regression fixtures', () => {
    for (const key of CRITERIA_KEYS) {
      expect(criterionClaimScope('full_manuscript', key)).toBe('MANUSCRIPT_WIDE');
    }
  });

  it('downgrades uncertified long-form criteria before serialization', () => {
    const artifact = makeValidArtifactV2();
    const first = artifact.criteria[0];
    const downgraded = downgradeCriterionForUncertifiedLongForm(first, [
      'LONG_FORM_PARTIAL_EVALUATION',
      'LONG_FORM_SAMPLED_COVERAGE',
    ]);

    expect(downgraded.status).toBe('INSUFFICIENT_SIGNAL');
    expect(downgraded.scorable).toBe(false);
    expect(downgraded.score_0_10).toBeNull();
    expect(downgraded.confidence_band).toBe('LOW');
    expect(downgraded.insufficient_signal_reason?.not_found).toEqual(
      expect.arrayContaining(['LONG_FORM_PARTIAL_EVALUATION', 'LONG_FORM_SAMPLED_COVERAGE'])
    );
    expect(downgraded.recommendations.length).toBeGreaterThan(0);
  });

  it('fails validation when uncertified LONG_FORM leaves manuscript-wide criteria SCORABLE', () => {
    const artifact = makeValidArtifactV2();
    artifact.governance.transparency = {
      ...artifact.governance.transparency,
      evaluation_scope: {
        route: 'LONG_FORM',
        input_scale: 'full_manuscript',
        manuscript_wide_certifiable: false,
        reason_codes: ['LONG_FORM_PARTIAL_EVALUATION', 'LONG_FORM_SAMPLED_COVERAGE'],
        criterion_scope_policy_version: SCOPE_POLICY_VERSION,
      },
      coverage_summary: {
        partial_evaluation: true,
        sampling_strategy: 'sampled_beginning_middle_end',
        source_word_count: ANCIENT_BLOODLINES_WORD_COUNT,
        analyzed_word_count: SAMPLED_WORD_COUNT,
        source_char_count: ANCIENT_BLOODLINES_CHAR_COUNT,
        analyzed_char_count: SAMPLED_CHAR_COUNT,
      },
    };

    const validation = validateEvaluationArtifact(artifact);
    expect(validation.ok).toBe(false);
    if (validation.ok === false) {
      expect(JSON.stringify(validation.issues)).toContain('LONG_FORM_UNCERTIFIED_MANUSCRIPT_WIDE_SCORE');
    }
  });

  it('passes validation after deterministic downgrade converts SCORABLE to INSUFFICIENT_SIGNAL', () => {
    const artifact = makeValidArtifactV2();
    const reasonCodes = ['LONG_FORM_PARTIAL_EVALUATION', 'LONG_FORM_SAMPLED_COVERAGE'];

    artifact.criteria = artifact.criteria.map((criterion) =>
      downgradeCriterionForUncertifiedLongForm(criterion, reasonCodes)
    );
    artifact.overview.scored_criteria_count = 0;
    artifact.overview.overall_score_0_100 = null;
    artifact.governance.transparency = {
      ...artifact.governance.transparency,
      evaluation_scope: {
        route: 'LONG_FORM',
        input_scale: 'full_manuscript',
        manuscript_wide_certifiable: false,
        reason_codes: reasonCodes,
        criterion_scope_policy_version: SCOPE_POLICY_VERSION,
      },
      coverage_summary: {
        partial_evaluation: true,
        sampling_strategy: 'sampled_beginning_middle_end',
        source_word_count: ANCIENT_BLOODLINES_WORD_COUNT,
        analyzed_word_count: SAMPLED_WORD_COUNT,
        source_char_count: ANCIENT_BLOODLINES_CHAR_COUNT,
        analyzed_char_count: SAMPLED_CHAR_COUNT,
      },
    };

    const validation = validateEvaluationArtifact(artifact);
    expect(validation.ok).toBe(true);
  });

  it('fails quality gate before persistence when stale full_manuscript artifact leaves uncertified criteria SCORABLE', () => {
    const prev = process.env.EVAL_SCOPE_PROFILE_ENABLED;
    process.env.EVAL_SCOPE_PROFILE_ENABLED = 'true';

    try {
      const artifact = makeValidArtifactV2();
      artifact.governance.transparency = {
        ...artifact.governance.transparency,
        coverage_summary: {
          partial_evaluation: true,
          sampling_strategy: 'sampled_beginning_middle_end',
          source_word_count: ANCIENT_BLOODLINES_WORD_COUNT,
          analyzed_word_count: SAMPLED_WORD_COUNT,
          source_char_count: ANCIENT_BLOODLINES_CHAR_COUNT,
          analyzed_char_count: SAMPLED_CHAR_COUNT,
        },
      };

      const gate = runQualityGateV2(artifact, undefined, makeArtificialFullManuscriptScopeProfile());
      const longFormCheck = gate.checks.find((c) => c.check_id === 'long_form_certification');

      expect(longFormCheck).toBeDefined();
      expect(longFormCheck?.passed).toBe(false);
      expect(gate.pass).toBe(false);
    } finally {
      if (prev === undefined) {
        delete process.env.EVAL_SCOPE_PROFILE_ENABLED;
      } else {
        process.env.EVAL_SCOPE_PROFILE_ENABLED = prev;
      }
    }
  });

  it('coverage-limited summary explicitly downgrades emotional posture language', () => {
    const summary = buildCoverageLimitedSummary({
      sourceChars: ANCIENT_BLOODLINES_CHAR_COUNT,
      sourceWords: ANCIENT_BLOODLINES_WORD_COUNT,
      analyzedChars: SAMPLED_CHAR_COUNT,
      analyzedWords: SAMPLED_WORD_COUNT,
      strategy: 'sampled_beginning_middle_end',
    });

    expect(summary.toLowerCase()).toContain('coverage-limited');
    expect(summary.toLowerCase()).toContain('cannot support certified manuscript-wide scoring');
  });
});
