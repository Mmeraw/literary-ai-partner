/**
 * Tests for Pass 3 semantic contract and normalization.
 */

import { normalizeIssueFamily, normalizeStrategicLever, normalizeRevisionGranularity, buildRedundancyKey } from '../normalization';

import { Pass3ContractError, normalizeAndValidatePass3Output, assertRecommendationSemanticFields, assertSubmissionReadiness } from '../pass3ContractValidator';

import type { SynthesisOutput, SynthesizedCriterion } from '../types';

describe('normalizeIssueFamily', () => {
  it('passes through canonical values', () => {
    expect(normalizeIssueFamily('pacing')).toBe('pacing');
    expect(normalizeIssueFamily('voice')).toBe('voice');
    expect(normalizeIssueFamily('market_positioning')).toBe('market_positioning');
  });

  it('normalizes case and whitespace', () => {
    expect(normalizeIssueFamily('PACING')).toBe('pacing');
    expect(normalizeIssueFamily('  voice  ')).toBe('voice');
  });

  it('normalizes variants to canonical', () => {
    expect(normalizeIssueFamily('prose')).toBe('prose_control');
    expect(normalizeIssueFamily('style')).toBe('prose_control');
    expect(normalizeIssueFamily('structure')).toBe('scene_structure');
    expect(normalizeIssueFamily('tone')).toBe('voice');
    expect(normalizeIssueFamily('market')).toBe('market_positioning');
  });

  it('falls back safely on invalid input', () => {
    expect(normalizeIssueFamily(null)).toBe('prose_control');
    expect(normalizeIssueFamily(123)).toBe('prose_control');
    expect(normalizeIssueFamily('invalid_unknown_category')).toBe('prose_control');
  });
});

describe('normalizeStrategicLever', () => {
  it('passes through canonical values', () => {
    expect(normalizeStrategicLever('momentum_visibility')).toBe('momentum_visibility');
    expect(normalizeStrategicLever('prose_compression')).toBe('prose_compression');
  });

  it('normalizes momentum-related phrasings', () => {
    expect(normalizeStrategicLever('forward momentum')).toBe('momentum_visibility');
    expect(normalizeStrategicLever('vary rhythm')).toBe('momentum_visibility');
    expect(normalizeStrategicLever('interleave action')).toBe('momentum_visibility');
    expect(normalizeStrategicLever('INCREASE MOMENTUM')).toBe('momentum_visibility');
  });

  it('normalizes dialogue-related phrasings', () => {
    expect(normalizeStrategicLever('on the nose dialogue')).toBe('dialogue_exposition_density');
    expect(normalizeStrategicLever('reduce exposition in dialogue')).toBe(
      'dialogue_exposition_density',
    );
  });

  it('normalizes market/prose/tension phrasings', () => {
    expect(normalizeStrategicLever('cut wordiness')).toBe('prose_compression');
    expect(normalizeStrategicLever('raise tension')).toBe('tension_escalation');
    expect(normalizeStrategicLever('marketability')).toBe('market_signal_clarity');
  });

  it('falls back safely', () => {
    expect(normalizeStrategicLever(null)).toBe('momentum_visibility');
    expect(normalizeStrategicLever('unknown_lever_xyz')).toBe('momentum_visibility');
  });
});

describe('normalizeRevisionGranularity', () => {
  it('passes through canonical values', () => {
    expect(normalizeRevisionGranularity('line')).toBe('line');
    expect(normalizeRevisionGranularity('scene')).toBe('scene');
    expect(normalizeRevisionGranularity('manuscript')).toBe('manuscript');
  });

  it('normalizes variants to canonical levels', () => {
    expect(normalizeRevisionGranularity('word')).toBe('line');
    expect(normalizeRevisionGranularity('sentence')).toBe('line');
    expect(normalizeRevisionGranularity('paragraph')).toBe('beat');
    expect(normalizeRevisionGranularity('block')).toBe('beat');
    expect(normalizeRevisionGranularity('chapter')).toBe('chapter');
    expect(normalizeRevisionGranularity('section')).toBe('chapter');
    expect(normalizeRevisionGranularity('book')).toBe('manuscript');
    expect(normalizeRevisionGranularity('full')).toBe('manuscript');
  });

  it('falls back safely', () => {
    expect(normalizeRevisionGranularity(null)).toBe('scene');
    expect(normalizeRevisionGranularity('unknown_level')).toBe('scene');
  });
});

describe('buildRedundancyKey', () => {
  it('builds deterministic key from three fields', () => {
    const key = buildRedundancyKey('pacing', 'momentum_visibility', 'scene');
    expect(key).toBe('pacing:momentum_visibility:scene');
  });

  it('handles undefined fields gracefully', () => {
    const key1 = buildRedundancyKey(undefined, 'momentum_visibility', 'scene');
    expect(key1).toBe('unknown:momentum_visibility:scene');

    const key2 = buildRedundancyKey('pacing', undefined, undefined);
    expect(key2).toBe('pacing:unknown:unknown');
  });

  it('is stable across calls', () => {
    const key1 = buildRedundancyKey('pacing', 'momentum_visibility', 'scene');
    const key2 = buildRedundancyKey('pacing', 'momentum_visibility', 'scene');
    expect(key1).toBe(key2);
  });
});

describe('assertRecommendationSemanticFields', () => {
  it('passes when all semantic fields present', () => {
    const rec = {
      priority: 'high' as const,
      action: 'Vary pacing',
      expected_impact: 'Better flow',
      anchor_snippet: 'some text',
      source_pass: 1 as const,
      issue_family: 'pacing' as const,
      strategic_lever: 'momentum_visibility' as const,
      revision_granularity: 'scene' as const,
    };
    expect(() => assertRecommendationSemanticFields(rec, 'prose_control', 0)).not.toThrow();
  });

  it('throws on missing issue_family', () => {
    const rec = {
      priority: 'high' as const,
      action: 'Vary pacing',
      expected_impact: 'Better flow',
      anchor_snippet: 'some text',
      source_pass: 1 as const,
      strategic_lever: 'momentum_visibility',
      revision_granularity: 'scene',
    } as any;
    expect(() => assertRecommendationSemanticFields(rec, 'prose_control', 0)).toThrow(
      Pass3ContractError,
    );
  });

  it('throws on missing strategic_lever', () => {
    const rec = {
      priority: 'high' as const,
      action: 'Vary pacing',
      expected_impact: 'Better flow',
      anchor_snippet: 'some text',
      source_pass: 1 as const,
      issue_family: 'pacing',
      revision_granularity: 'scene',
    } as any;
    expect(() => assertRecommendationSemanticFields(rec, 'prose_control', 0)).toThrow(
      Pass3ContractError,
    );
  });

  it('throws on missing revision_granularity', () => {
    const rec = {
      priority: 'high' as const,
      action: 'Vary pacing',
      expected_impact: 'Better flow',
      anchor_snippet: 'some text',
      source_pass: 1 as const,
      issue_family: 'pacing',
      strategic_lever: 'momentum_visibility',
    } as any;
    expect(() => assertRecommendationSemanticFields(rec, 'prose_control', 0)).toThrow(
      Pass3ContractError,
    );
  });
});

describe('assertSubmissionReadiness', () => {
  it('passes when submission_readiness present', () => {
    const overall = {
      overall_score_0_100: 75,
      verdict: 'pass' as const,
      submission_readiness: 'queryable_now' as const,
      one_paragraph_summary: 'Summary',
      top_3_strengths: [],
      top_3_risks: [],
    };
    expect(() => assertSubmissionReadiness(overall)).not.toThrow();
  });

  it('throws when submission_readiness missing', () => {
    const overall = {
      overall_score_0_100: 75,
      verdict: 'pass' as const,
      one_paragraph_summary: 'Summary',
      top_3_strengths: [],
      top_3_risks: [],
    } as any;
    expect(() => assertSubmissionReadiness(overall)).toThrow(Pass3ContractError);
  });
});

describe('normalizeAndValidatePass3Output', () => {
  it('normalizes semantic fields throughout', () => {
    const output: SynthesisOutput = {
      criteria: [
        {
          key: 'proseControl' as const,
          craft_score: 7,
          editorial_score: 8,
          final_score_0_10: 7,
          score_delta: 1,
          final_rationale: 'Good prose',
          pressure_points: [],
          decision_points: [],
          consequence_status: 'landed',
          evidence: [],
          recommendations: [
            {
              priority: 'high',
              action: 'fix',
              expected_impact: 'impact',
              anchor_snippet: 'snippet',
              source_pass: 3,
              issue_family: 'PROSE' as any,
              strategic_lever: 'CUT WORDINESS' as any,
              revision_granularity: 'PARAGRAPH' as any,
            },
          ],
        },
      ],
      overall: {
        overall_score_0_100: 75,
        verdict: 'pass' as const,
        submission_readiness: 'queryable_now' as const,
        one_paragraph_summary: 'Summary',
        top_3_strengths: [],
        top_3_risks: [],
      },
      metadata: {
        pass1_model: 'o3',
        pass2_model: 'o3',
        pass3_model: 'o3',
        generated_at: new Date().toISOString(),
      },
      partial_evaluation: false,
    };

    const normalized = normalizeAndValidatePass3Output(output, true);

    expect(normalized.criteria[0].recommendations[0].issue_family).toBe('prose_control');
    expect(normalized.criteria[0].recommendations[0].strategic_lever).toBe('prose_compression');
    expect(normalized.criteria[0].recommendations[0].revision_granularity).toBe('beat');
    expect(normalized.criteria[0].recommendations[0].redundancy_key).toBe(
      'prose_control:prose_compression:beat',
    );
  });

  it('enforces fresh output contract on validation', () => {
    const output: SynthesisOutput = {
      criteria: [
        {
          key: 'proseControl' as const,
          craft_score: 7,
          editorial_score: 8,
          final_score_0_10: 7,
          score_delta: 1,
          final_rationale: 'Good prose',
          pressure_points: [],
          decision_points: [],
          consequence_status: 'landed',
          evidence: [],
          recommendations: [
            {
              priority: 'high',
              action: 'fix',
              expected_impact: 'impact',
              anchor_snippet: 'snippet',
              source_pass: 3,
              // Missing semantic fields — should throw
            } as any,
          ],
        },
      ],
      overall: {
        overall_score_0_100: 75,
        verdict: 'pass',
        submission_readiness: 'queryable_now',
        one_paragraph_summary: 'Summary',
        top_3_strengths: [],
        top_3_risks: [],
      },
      metadata: {
        pass1_model: 'o3',
        pass2_model: 'o3',
        pass3_model: 'o3',
        generated_at: new Date().toISOString(),
      },
      partial_evaluation: false,
    };

    expect(() => normalizeAndValidatePass3Output(output, true)).toThrow(Pass3ContractError);
  });

  it('allows backward-compat read of old artifacts (isFreshOutput=false)', () => {
    const output: SynthesisOutput = {
      criteria: [
        {
          key: 'proseControl' as const,
          craft_score: 7,
          editorial_score: 8,
          final_score_0_10: 7,
          score_delta: 1,
          final_rationale: 'Good prose',
          pressure_points: [],
          decision_points: [],
          consequence_status: 'landed',
          evidence: [],
          recommendations: [
            {
              priority: 'high',
              action: 'fix',
              expected_impact: 'impact',
              anchor_snippet: 'snippet',
              source_pass: 3,
              // No semantic fields — but OK for legacy read
            } as any,
          ],
        },
      ],
      overall: {
        overall_score_0_100: 75,
        verdict: 'pass',
        // No submission_readiness — but OK for legacy read
        one_paragraph_summary: 'Summary',
        top_3_strengths: [],
        top_3_risks: [],
      } as any,
      metadata: {
        pass1_model: 'o3',
        pass2_model: 'o3',
        pass3_model: 'o3',
        generated_at: new Date().toISOString(),
      },
      partial_evaluation: false,
    };

    // Should not throw when isFreshOutput=false
    const normalized = normalizeAndValidatePass3Output(output, false);
    expect(normalized).toBeDefined();
  });
});
