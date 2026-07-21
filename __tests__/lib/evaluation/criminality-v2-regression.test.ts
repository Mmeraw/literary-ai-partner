/**
 * Criminality V2 regression suite.
 *
 * Uses the exact quarantine payload from job e7d88308-7deb-4bdc-85af-b7d82c271b4c
 * to prove the Pass 3 transformation/normalization defects are fixed.
 */

jest.mock('@/lib/evaluation/pipeline/evaluationCertificationGate', () => {
  const actual = jest.requireActual('@/lib/evaluation/pipeline/evaluationCertificationGate');
  return {
    ...actual,
    runEvaluationCertificationGate: jest.fn((...args: any[]) => actual.runEvaluationCertificationGate(...args)),
  };
});

import {
  normalizeArtifact,
  ArtifactTextContractError,
} from '@/lib/evaluation/pipeline/normalizeArtifact';
import { reconcileSummaryScore } from '@/lib/evaluation/pipeline/runPass3Synthesis';
import {
  buildECGInputFromEvaluationResult,
  runEvaluationCertificationGate,
} from '@/lib/evaluation/pipeline/evaluationCertificationGate';
import { runShortFormFinalSanityCheck } from '@/lib/evaluation/pipeline/shortFormFinalSanityCheck';
import { toReportVerdict, synthesisToEvaluationResultV2 } from '@/lib/evaluation/pipeline/runPipeline';
import { endsMidSentence } from '@/lib/text/authorFacingProse';
import type { CurrentSynthesisOutput, SynthesisOutput } from '@/lib/evaluation/pipeline/types';
import type { EvaluationResultV2 } from '@/schemas/evaluation-result-v2';
import type { CriterionKey } from '@/schemas/criteria-keys';
import { makeCurrentProcessorSynthesisOutput } from './test-fixtures/currentProcessorSynthesisOutput';

const fixture = require('../../fixtures/evaluation/criminality-v2-quarantine-pass3.json') as EvaluationResultV2;

const KNOWN_RENDERER_VERDICTS = [
  'market_ready',
  'not_market_ready',
  'conditional',
  'not_evaluable',
  'coverage_limited',
  'withheld',
] as const;

function isRendererVerdict(value: string): boolean {
  return (KNOWN_RENDERER_VERDICTS as readonly string[]).includes(value);
}

function endsWithTerminalPunctuation(text: string): boolean {
  return /[.!?…]["'”’)\]]*$/u.test(text.trim());
}

// The quarantine fixture's one_paragraph_pitch is intentionally truncated.
// Tests that exercise canonical preservation/ECG certification use a
// complete, single-paragraph pitch so they prove the validation policy.
const COMPLETE_PARAGRAPH_PITCH =
  'A grieving Toronto father uses a bedtime story about MJ, a would-be drug smuggler bound for a desert festival of Desire, to teach his son Aralık that criminality is tangled with love, loss, and the oppressive systems watching them all.';

function sanitizeTestProse(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  let text = value
    .replace(/…/g, ' ')
    .replace(/\.{3}/g, ' ')
    .replace(/\s+([,:;.!?])/gu, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  text = text.replace(/[,;:—\-([{]+$/u, '');
  if (!/[.!?]$/.test(text)) text += '.';
  if (!/[a-zA-Z]/.test(text.charAt(0))) return fallback;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function sanitizeRecommendationForTest(r: any, key: string) {
  return {
    priority: r.priority,
    action: sanitizeTestProse(r.action, `Address the ${key} issue in one focused revision.`),
    expected_impact: sanitizeTestProse(r.expected_impact, `This will strengthen ${key} in the next draft.`),
    anchor_snippet: r.anchor_snippet,
    mechanism: sanitizeTestProse(r.mechanism, `The ${key} craft signal needs a more concrete textual anchor.`),
    specific_fix: sanitizeTestProse(r.specific_fix, `Ground the ${key} work in one specific scene beat.`),
    reader_effect: sanitizeTestProse(r.reader_effect, `The reader will feel the ${key} payoff more clearly.`),
    symptom: sanitizeTestProse(r.symptom, `The ${key} signal is not yet fully landing for the reader.`),
    mistake_proofing: r.mistake_proofing,
    candidate_text_a: r.candidate_text_a,
    candidate_text_b: r.candidate_text_b,
    candidate_text_c: r.candidate_text_c,
    revision_operation: r.revision_operation,
    manuscript_coordinates: r.manuscript_coordinates,
    issue_family: r.issue_family,
    strategic_lever: r.strategic_lever,
    revision_granularity: r.revision_granularity,
  };
}

function fixtureCriterionToSynthesized(c: any) {
  return {
    key: c.key as CriterionKey,
    final_score_0_10: typeof c.score_0_10 === 'number' ? c.score_0_10 : null,
    final_rationale: c.rationale,
    evidence: (c.evidence ?? []).map((e: any) => ({
      snippet: e.snippet,
      char_start: e.location?.char_start,
      char_end: e.location?.char_end,
      segment_id: e.location?.segment_id,
    })),
    recommendations: (c.recommendations ?? []).map((r: any) => sanitizeRecommendationForTest(r, c.key)),
  };
}

function buildSynthesisFromFixture(
  overrides?: Partial<SynthesisOutput['overall']>,
): CurrentSynthesisOutput {
  return makeCurrentProcessorSynthesisOutput({
    criteria: fixture.criteria.map(fixtureCriterionToSynthesized),
    overall: {
      overall_score_0_100: fixture.overview.overall_score_0_100 ?? 70,
      verdict: 'revise' as const,
      one_paragraph_summary: fixture.overview.one_paragraph_summary,
      one_sentence_pitch: fixture.overview.one_sentence_pitch,
      one_paragraph_pitch: fixture.overview.one_paragraph_pitch,
      top_3_strengths: fixture.overview.top_3_strengths,
      top_3_risks: fixture.overview.top_3_risks,
      submission_readiness: 'nearly_ready' as const,
      ...overrides,
    },
    metadata: {
      pass1_model: 'test',
      pass2_model: 'test',
      pass3_model: fixture.engine.model,
      generated_at: fixture.generated_at,
    },
    partial_evaluation: false,
  });
}

describe('Criminality V2 regression', () => {
  describe('normalizeArtifact', () => {
    it('preserves the complete one_paragraph_pitch without canonical trimming', () => {
      const synthesis = buildSynthesisFromFixture({
        one_sentence_pitch: undefined,
        one_paragraph_pitch: COMPLETE_PARAGRAPH_PITCH,
      });
      const before = synthesis.overall.one_paragraph_pitch;
      normalizeArtifact(synthesis, [], []);

      const pitch = synthesis.overall.one_paragraph_pitch ?? '';
      expect(pitch).toBe(before);
      expect(pitch.length).toBeLessThanOrEqual(10_000);
      expect(endsWithTerminalPunctuation(pitch)).toBe(true);
      expect(endsMidSentence(pitch)).toBe(false);
    });

    it('does not alter a complete within-cap summary', () => {
      const synthesis = buildSynthesisFromFixture({
        one_sentence_pitch: undefined,
        one_paragraph_pitch: COMPLETE_PARAGRAPH_PITCH,
      });
      const before = synthesis.overall.one_paragraph_summary;
      normalizeArtifact(synthesis, [], []);
      expect(synthesis.overall.one_paragraph_summary).toBe(before);
    });

    it('fails an over-cap one-sentence pitch without truncating it', () => {
      const longPitch = `A ${Array.from({ length: 1250 }, (_, i) => `w${i}`).join(' ')} long but grammatically complete pitch.`;
      const synthesis = buildSynthesisFromFixture({ one_sentence_pitch: longPitch });
      try {
        normalizeArtifact(synthesis, [], []);
        throw new Error('Expected ArtifactTextContractError');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ArtifactTextContractError);
        expect(error.field).toBe('overview.one_sentence_pitch');
        expect(error.reason).toBe('ONE_SENTENCE_PITCH_OVER_CAP');
        expect(error.actualLength).toBeGreaterThan(5000);
        expect(error.cap).toBe(5000);
      }
    });

    it('fails a multi-sentence one_sentence_pitch rather than retaining the first sentence', () => {
      const synthesis = buildSynthesisFromFixture({
        one_sentence_pitch: 'The father tells a story. His son learns a hard lesson about love.',
      });
      try {
        normalizeArtifact(synthesis, [], []);
        throw new Error('Expected ArtifactTextContractError');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ArtifactTextContractError);
        expect(error.reason).toBe('ONE_SENTENCE_PITCH_MULTIPLE_SENTENCES');
      }
    });

    it('does not normalize strengths or risks under the pitch/summary contract', () => {
      const synthesis = buildSynthesisFromFixture({
        one_sentence_pitch: undefined,
        one_paragraph_pitch: COMPLETE_PARAGRAPH_PITCH,
        top_3_strengths: ['A deliberately phrase-style strength'],
        top_3_risks: ['A deliberately phrase-style risk'],
      });
      normalizeArtifact(synthesis, [], []);
      expect(synthesis.overall.top_3_strengths).toEqual(['A deliberately phrase-style strength']);
      expect(synthesis.overall.top_3_risks).toEqual(['A deliberately phrase-style risk']);
    });
  });

  it('grounds executive-summary score language to the canonical 70/100', () => {
    const result = reconcileSummaryScore(fixture.overview.one_paragraph_summary, 70);
    expect(result.reconciled).toBe(true);
    expect(result.originalScores).toEqual([65]);
    expect(result.summary).not.toContain('65/100');
    expect(result.summary).toContain('70/100');
  });

  it('maps internal verdicts deterministically', () => {
    expect(toReportVerdict('pass', { coverageLimited: false, scoredCount: 13 })).toBe('market_ready');
    expect(toReportVerdict('revise', { coverageLimited: false, scoredCount: 13 })).toBe('conditional');
    expect(toReportVerdict('fail', { coverageLimited: false, scoredCount: 13 })).toBe('not_market_ready');
    expect(isRendererVerdict(toReportVerdict('pass', { coverageLimited: true, scoredCount: 13 }))).toBe(true);
    expect(isRendererVerdict(toReportVerdict('pass', { coverageLimited: false, scoredCount: 0 }))).toBe(true);
  });

  it('does not false-positive on "millimeter wave" and reports a field for a real leak', () => {
    const result = runShortFormFinalSanityCheck({
      wordCount: 3872,
      evaluationResult: {
        ...fixture,
        overview: { ...fixture.overview, verdict: 'conditional' as const },
      },
    });

    const millimeterViolation = result.violations?.find(
      (violation) =>
        violation.code === 'SHORT_FORM_LONGFORM_ARTIFACT_LEAK' && /millimeter/i.test(violation.sample),
    );
    expect(millimeterViolation).toBeUndefined();

    for (const violation of result.violations ?? []) {
      if (violation.code === 'SHORT_FORM_LONGFORM_ARTIFACT_LEAK') {
        expect(violation.field).toBeTruthy();
      }
    }
  });

  describe('ECG authority boundary', () => {
    beforeEach(() => {
      jest.mocked(runEvaluationCertificationGate).mockClear();
    });

    it('does not invoke ECG when the pitch text contract fails', () => {
      const synthesis = buildSynthesisFromFixture({
        one_sentence_pitch: 'A father tells a story. His son learns a lesson about love.',
        one_paragraph_pitch: COMPLETE_PARAGRAPH_PITCH,
      });

      expect(() =>
        synthesisToEvaluationResultV2({
          synthesis,
          ids: fixture.ids as any,
          title: fixture.metrics?.manuscript?.title,
          manuscriptText: 'x'.repeat(23165),
          englishVariant: 'us',
          llmEnrichment: {
            premise: 'A father teaches his son about love through a story.',
            diagnosed_genre: 'novel',
            target_audience: 'Adult literary fiction readers.',
          },
        }),
      ).toThrow(ArtifactTextContractError);

      expect(jest.mocked(runEvaluationCertificationGate)).not.toHaveBeenCalled();
    });

    it('builds ECG input from the canonical result fields', () => {
      const result: EvaluationResultV2 = {
        ...fixture,
        overview: { ...fixture.overview, verdict: 'conditional' as const },
      };
      const ecgInput = buildECGInputFromEvaluationResult(result, 70);
      expect(ecgInput.overview).toEqual({
        overall_score_0_100: result.overview.overall_score_0_100,
        scored_criteria_count: result.overview.scored_criteria_count,
        verdict: result.overview.verdict,
        one_paragraph_summary: result.overview.one_paragraph_summary,
        one_sentence_pitch: result.overview.one_sentence_pitch ?? null,
        one_paragraph_pitch: result.overview.one_paragraph_pitch ?? null,
        top_3_strengths: result.overview.top_3_strengths,
        top_3_risks: result.overview.top_3_risks,
      });
    });

    it('certifies the same substantive overview and criteria that it returns', () => {
      const pitchOnlySynthesis = buildSynthesisFromFixture({
        one_sentence_pitch: undefined,
        one_paragraph_pitch: COMPLETE_PARAGRAPH_PITCH,
      });
      normalizeArtifact(pitchOnlySynthesis, [], []);

      const synthesis = buildSynthesisFromFixture({
        one_paragraph_summary: reconcileSummaryScore(
          fixture.overview.one_paragraph_summary,
          fixture.overview.overall_score_0_100 ?? 70,
        ).summary,
        one_paragraph_pitch: pitchOnlySynthesis.overall.one_paragraph_pitch,
        one_sentence_pitch: 'A queer family bedtime story becomes a probe into state power and queer love.',
      });

      const result = synthesisToEvaluationResultV2({
        synthesis,
        ids: fixture.ids as any,
        title: fixture.metrics?.manuscript?.title,
        manuscriptText: 'x'.repeat(23165),
        englishVariant: 'us',
        llmEnrichment: {
          premise: 'A Toronto father improvises a story to teach his son how systems criminalize queer love and dissent.',
          diagnosed_genre: 'novel',
          target_audience: 'Readers of literary fiction interested in queer family-making and surveillance.',
        },
      });

      expect(result.overview.overall_score_0_100).toBe(70);
      expect(isRendererVerdict(result.overview.verdict)).toBe(true);

      const mockedECG = jest.mocked(runEvaluationCertificationGate);
      expect(mockedECG).toHaveBeenCalled();
      const captured = mockedECG.mock.calls[mockedECG.mock.calls.length - 1][0];
      const expected = buildECGInputFromEvaluationResult(
        result,
        result.overview.overall_score_0_100 ?? 70,
      );

      expect(captured.overview).toEqual(expected.overview);
      expect(captured.criteria).toEqual(expected.criteria);
    });
  });
});
