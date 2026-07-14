/**
 * Criminality V2 regression suite.
 *
 * Uses the exact quarantine payload from job e7d88308-7deb-4bdc-85af-b7d82c271b4c
 * to prove the Pass 3 transformation/normalization defects are fixed.
 *
 * Invariants:
 *   1. No output ends mid-word.
 *   2. No required prose ends mid-sentence.
 *   3. Prose score cannot exceed or disagree with the canonical score.
 *   4. Renderer verdict cannot be "unknown" when gate_decision is known.
 *   5. Short-form output cannot contain long-form-only sections (and the leaking field is identified).
 *   6. The object passed to ECG is identical to the object returned/persisted.
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
import type { SynthesisOutput } from '@/lib/evaluation/pipeline/types';
import type { EvaluationResultV2 } from '@/schemas/evaluation-result-v2';

const fixture = require('../../fixtures/evaluation/criminality-v2-quarantine-pass3.json') as EvaluationResultV2;

const KNOWN_RENDERER_VERDICTS = [
  'market_ready',
  'not_market_ready',
  'conditional',
  'not_evaluable',
  'coverage_limited',
  'withheld',
] as const;

type RendererVerdict = (typeof KNOWN_RENDERER_VERDICTS)[number];

function isRendererVerdict(v: string): v is RendererVerdict {
  return (KNOWN_RENDERER_VERDICTS as readonly string[]).includes(v);
}

function endsWithTerminalPunctuation(text: string): boolean {
  return /[.!?…]["'”’)\]]*$/u.test(text.trim());
}

function fixtureCriterionToSynthesized(c: any) {
  return {
    key: c.key,
    final_score_0_10: typeof c.score_0_10 === 'number' ? c.score_0_10 : null,
    final_rationale: c.rationale,
    evidence: (c.evidence ?? []).map((e: any) => ({
      snippet: e.snippet,
      char_start: e.location?.char_start,
      char_end: e.location?.char_end,
      segment_id: e.location?.segment_id,
    })),
    recommendations: (c.recommendations ?? []).map((r: any) => ({
      priority: r.priority,
      action: r.action,
      expected_impact: r.expected_impact,
      anchor_snippet: r.anchor_snippet,
      mechanism: r.mechanism,
      specific_fix: r.specific_fix,
      reader_effect: r.reader_effect,
      symptom: r.symptom,
      mistake_proofing: r.mistake_proofing,
      candidate_text_a: r.candidate_text_a,
      candidate_text_b: r.candidate_text_b,
      candidate_text_c: r.candidate_text_c,
      revision_operation: r.revision_operation,
      manuscript_coordinates: r.manuscript_coordinates,
      issue_family: r.issue_family,
      strategic_lever: r.strategic_lever,
      revision_granularity: r.revision_granularity,
    })),
  };
}

function buildSynthesisFromFixture(overrides?: Partial<SynthesisOutput['overall']>): SynthesisOutput {
  return {
    criteria: fixture.criteria.map(fixtureCriterionToSynthesized) as any,
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
  } as SynthesisOutput;
}

describe('Criminality V2 regression', () => {
  describe('normalizeArtifact', () => {
    it('trims one_paragraph_pitch to a complete sentence and removes the mid-word "dev" fragment', () => {
      const synthesis = buildSynthesisFromFixture({ one_sentence_pitch: undefined });
      normalizeArtifact(synthesis, [], []);

      const pitch = synthesis.overall.one_paragraph_pitch ?? '';
      expect(pitch).not.toMatch(/dev$/);
      expect(pitch.length).toBeLessThanOrEqual(750);
      expect(endsWithTerminalPunctuation(pitch)).toBe(true);
      expect(endsMidSentence(pitch)).toBe(false);
    });

    it('does not alter the one_paragraph_summary when it is within cap and ends with a complete sentence', () => {
      const synthesis = buildSynthesisFromFixture({ one_sentence_pitch: undefined });
      const before = synthesis.overall.one_paragraph_summary;
      normalizeArtifact(synthesis, [], []);
      expect(synthesis.overall.one_paragraph_summary).toBe(before);
      expect(endsMidSentence(synthesis.overall.one_paragraph_summary)).toBe(false);
    });

    it('fails a one-sentence pitch that exceeds the cap and has no earlier complete sentence', () => {
      const synthesis = buildSynthesisFromFixture();
      expect(() => normalizeArtifact(synthesis, [], [])).toThrow(ArtifactTextContractError);
      try {
        normalizeArtifact(synthesis, [], []);
      } catch (e: any) {
        expect(e.field).toBe('overview.one_sentence_pitch');
        expect(e.reason).toBe('ONE_SENTENCE_PITCH_OVER_CAP');
        expect(e.actualLength).toBeGreaterThan(220);
        expect(e.cap).toBe(220);
      }
    });

    it('fails a one-sentence pitch that contains two sentences, even when the first fits under the cap', () => {
      // 140 characters, well under the 220 cap, but two sentences. The contract
      // requires exactly one complete sentence; it must not retain the first.
      const synthesis = buildSynthesisFromFixture({
        one_sentence_pitch: 'The father tells a story. His son learns a hard lesson about love.',
      });
      expect(() => normalizeArtifact(synthesis, [], [])).toThrow(ArtifactTextContractError);
      try {
        normalizeArtifact(synthesis, [], []);
      } catch (e: any) {
        expect(e.field).toBe('overview.one_sentence_pitch');
        expect(e.reason).toBe('ONE_SENTENCE_PITCH_MULTIPLE_SENTENCES');
      }
    });

    it('accepts a one-sentence pitch containing abbreviations as a single sentence', () => {
      // "U.S.", "Dr.", and "e.g." should not be counted as sentence terminators.
      const synthesis = buildSynthesisFromFixture({
        one_sentence_pitch: 'A Dr. Smith story set in the U.S., e.g. a family saga, unfolds in one sentence.',
      });
      normalizeArtifact(synthesis, [], []);
      expect(synthesis.overall.one_sentence_pitch).toBe(
        'A Dr. Smith story set in the U.S., e.g. a family saga, unfolds in one sentence.',
      );
    });

    it('does not emit an ellipsis-truncated sentence for any prose field', () => {
      const synthesis = buildSynthesisFromFixture({ one_sentence_pitch: undefined });
      normalizeArtifact(synthesis, [], []);
      for (const field of [
        'one_paragraph_summary',
        'one_paragraph_pitch',
      ] as const) {
        const value = synthesis.overall[field];
        if (typeof value === 'string') {
          expect(value).not.toMatch(/\.\.$/);
          expect(value).not.toMatch(/…$/);
          expect(endsMidSentence(value)).toBe(false);
        }
      }
    });
  });

  describe('reconcileSummaryScore', () => {
    it('grounds executive-summary score language to the canonical 70/100', () => {
      const summary = fixture.overview.one_paragraph_summary;
      const result = reconcileSummaryScore(summary, 70);
      expect(result.reconciled).toBe(true);
      expect(result.originalScores).toEqual([65]);
      expect(result.summary).not.toContain('65/100');
      expect(result.summary).toContain('70/100');
    });
  });

  describe('toReportVerdict', () => {
    it('maps internal pass/revise/fail to renderer-facing vocabulary', () => {
      expect(toReportVerdict('pass', { coverageLimited: false, scoredCount: 13 })).toBe('market_ready');
      expect(toReportVerdict('revise', { coverageLimited: false, scoredCount: 13 })).toBe('conditional');
      expect(toReportVerdict('fail', { coverageLimited: false, scoredCount: 13 })).toBe('not_market_ready');
    });

    it('returns deterministic renderer verdicts for boundary conditions', () => {
      expect(toReportVerdict('pass', { coverageLimited: true, scoredCount: 13 })).toBe('coverage_limited');
      expect(toReportVerdict('pass', { coverageLimited: false, scoredCount: 0 })).toBe('not_evaluable');
      // Any unrecognized internal value must still map to a known renderer verdict.
      expect(isRendererVerdict(toReportVerdict('revise', { coverageLimited: false, scoredCount: 13 }))).toBe(true);
    });
  });

  describe('runShortFormFinalSanityCheck', () => {
    it('does not false-positive on "millimeter wave" and reports any long-form leak with a field path', () => {
      const result = runShortFormFinalSanityCheck({
        wordCount: 3872,
        evaluationResult: {
          ...fixture,
          overview: { ...fixture.overview, verdict: 'conditional' as const },
        },
      });

      const waveViolation = result.violations?.find((v) => v.code === 'SHORT_FORM_LONGFORM_ARTIFACT_LEAK');
      if (waveViolation) {
        expect(waveViolation.field).toBeTruthy();
        expect(waveViolation.sample).toMatch(/\bWAVE\b/);
      }
      // The case-insensitive "wave" in "millimeter wave" must not be flagged.
      const millimeterViolation = result.violations?.find(
        (v) => v.code === 'SHORT_FORM_LONGFORM_ARTIFACT_LEAK' && /millimeter/i.test(v.sample),
      );
      expect(millimeterViolation).toBeUndefined();
    });
  });

  describe('ECG object identity', () => {
    beforeEach(() => {
      jest.mocked(runEvaluationCertificationGate).mockClear();
    });

    it('does not invoke ECG when the one-sentence pitch violates its text contract', () => {
      const synthesis = buildSynthesisFromFixture({
        one_sentence_pitch: 'A father tells a story. His son learns a lesson about love.',
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

    it('buildECGInputFromEvaluationResult mirrors the canonical EvaluationResultV2 fields', () => {
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
      expect(ecgInput.criteria).toEqual(
        result.criteria.map((c) => ({
          key: c.key,
          final_score_0_10: (c as unknown as { score_0_10?: number | null }).score_0_10 ?? null,
          final_rationale: (c as unknown as { rationale?: string }).rationale ?? null,
        })),
      );
    });

    it('synthesisToEvaluationResultV2 certifies and returns the same EvaluationResultV2 object', () => {
      // Compute a clean one-paragraph pitch by normalizing a synthesis that has only that field.
      const pitchOnlySynthesis = buildSynthesisFromFixture({ one_sentence_pitch: undefined });
      normalizeArtifact(pitchOnlySynthesis, [], []);
      const normalizedPitch = pitchOnlySynthesis.overall.one_paragraph_pitch;

      const summary = reconcileSummaryScore(
        fixture.overview.one_paragraph_summary,
        fixture.overview.overall_score_0_100 ?? 70,
      ).summary;

      const synthesis = buildSynthesisFromFixture({
        one_paragraph_summary: summary,
        one_paragraph_pitch: normalizedPitch,
        one_sentence_pitch: 'A queer family bedtime story becomes a philosophical probe into state power and queer love.',
      });

      const result = synthesisToEvaluationResultV2({
        synthesis,
        ids: fixture.ids as any,
        title: fixture.metrics?.manuscript?.title,
        manuscriptText: 'x'.repeat(23165),
        englishVariant: 'us',
        llmEnrichment: {
          premise: 'A Toronto father improvises a morally ambiguous story to teach his son how systems criminalize queer love and dissent.',
          diagnosed_genre: 'novel',
          target_audience: 'Readers of literary fiction interested in queer family-making and systemic critiques of surveillance.',
        },
      });

      expect(result.overview.verdict).not.toBe('unknown');
      expect(isRendererVerdict(result.overview.verdict)).toBe(true);
      expect(result.overview.overall_score_0_100).toBe(70);

      // The object that ECG actually certified must be the exact object returned.
      const mockedECG = jest.mocked(runEvaluationCertificationGate);
      expect(mockedECG.mock.calls.length).toBeGreaterThan(0);
      const capturedEcgInput = mockedECG.mock.calls[mockedECG.mock.calls.length - 1][0];
      const expectedEcgInput = buildECGInputFromEvaluationResult(
        result,
        result.overview.overall_score_0_100 ?? 70,
      );

      // The mock delegates to the real ECG, so the real call must also certify.
      const ecgResult = runEvaluationCertificationGate(expectedEcgInput);
      expect(ecgResult.status).toBe('CERTIFIED');

      // Substantive certified fields match exactly. (Governance warnings are
      // appended immutably after certification and do not appear in the ECG input.)
      expect(capturedEcgInput.overview).toEqual(expectedEcgInput.overview);
      expect(capturedEcgInput.overview).toEqual(result.overview);
      expect(capturedEcgInput.criteria).toEqual(expectedEcgInput.criteria);
      expect(capturedEcgInput.criteria).toEqual(
        result.criteria.map((c) => ({
          key: c.key,
          final_score_0_10: (c as unknown as { score_0_10?: number | null }).score_0_10 ?? null,
          final_rationale: (c as unknown as { rationale?: string }).rationale ?? null,
        })),
      );
    });
  });
});
