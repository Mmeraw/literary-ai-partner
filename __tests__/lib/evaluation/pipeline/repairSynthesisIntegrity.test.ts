/**
 * Mistake-proofed author-facing integrity repair tests.
 *
 * Covers:
 *   - cd6d8266-… regression fixture (fit/gap ellipsis, lowercase final_rationale/specific_fix/candidate_text).
 *   - Whole-envelope integrity with simultaneous required + candidate failures.
 *   - Idempotence on an already-valid synthesis.
 *   - Manuscript evidence/quotation preservation.
 *   - Mutation boundary rejection of unrelated field changes.
 *   - Mixed candidate/required violations repaired in the same recovery cycle.
 */

export {};

import type { SynthesisOutput } from '@/lib/evaluation/pipeline/types';
import {
  repairSynthesisIntegrity,
} from '@/lib/evaluation/pipeline/repairSynthesisIntegrity';
import * as requiredProseRegeneration from '@/lib/evaluation/pipeline/requiredProseRegeneration';

jest.mock('@/lib/evaluation/pipeline/requiredProseRegeneration', () => ({
  ...jest.requireActual('@/lib/evaluation/pipeline/requiredProseRegeneration'),
  regenerateRequiredProse: jest.fn(),
}));

const mockedRegenerateRequiredProse = jest.mocked(
  requiredProseRegeneration.regenerateRequiredProse,
);

function setByPath(obj: unknown, path: string, value: unknown): boolean {
  const normalized = path.replace(/^evaluation_result_v2\./u, '');
  const parts = normalized.split('.');
  if (parts.length === 0) return false;
  let current: unknown = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    const arrayMatch = part.match(/^([^\[]+)\[(\d+)\]$/u);
    if (arrayMatch) {
      const key = arrayMatch[1]!;
      const index = parseInt(arrayMatch[2]!, 10);
      const arr = (current as Record<string, unknown>)[key];
      if (!Array.isArray(arr) || index >= arr.length) return false;
      current = arr[index];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
    if (current === undefined || current === null) return false;
  }
  const last = parts[parts.length - 1]!;
  const lastArrayMatch = last.match(/^([^\[]+)\[(\d+)\]$/u);
  if (lastArrayMatch) {
    const key = lastArrayMatch[1]!;
    const index = parseInt(lastArrayMatch[2]!, 10);
    const arr = (current as Record<string, unknown>)[key];
    if (!Array.isArray(arr) || index >= arr.length) return false;
    arr[index] = value;
  } else {
    (current as Record<string, unknown>)[last] = value;
  }
  return true;
}

function getByPath(obj: unknown, path: string): unknown {
  const normalized = path.replace(/^evaluation_result_v2\./u, '');
  const parts = normalized.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    const arrayMatch = part.match(/^([^\[]+)\[(\d+)\]$/u);
    if (arrayMatch) {
      const key = arrayMatch[1]!;
      const index = parseInt(arrayMatch[2]!, 10);
      const arr = (current as Record<string, unknown>)[key];
      if (!Array.isArray(arr) || index >= arr.length) return undefined;
      current = arr[index];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
    if (current === undefined || current === null) return undefined;
  }
  return current;
}

function makeValidSynthesis(): SynthesisOutput {
  return {
    criteria: [
      {
        key: 'concept',
        craft_score: 6,
        editorial_score: 6,
        final_score_0_10: 6,
        score_delta: 0,
        final_rationale: 'The concept is clearly present and grounded in concrete scene anchors.',
        fit_summary: 'The premise is identifiable and supported by early scene details.',
        gap_summary: 'The central promise could be sharpened before the midpoint.',
        pressure_points: ['The opening hook lands cleanly.'],
        decision_points: ['The protagonist chooses to enter the salon.'],
        consequence_status: 'landed',
        evidence: [
          {
            snippet:
              '"Heh, I am in the top X% of Canadians financially." Money was clearly one way he could differentiate himself.',
          },
        ],
        recommendations: [
          {
            priority: 'high',
            action: 'Clarify the protagonist’s goal in the first scene.',
            expected_impact: 'Readers will latch onto the central conflict immediately.',
            anchor_snippet: 'Money was clearly one way he could differentiate himself.',
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
      top_3_strengths: [
        'Distinctive first-person voice.',
        'Concrete scene details.',
        'Clear emotional arc.',
      ],
      top_3_risks: [
        'Concept is diffuse in the middle.',
        'Some transitions feel convenient.',
        'Ending rushes the emotional shift.',
      ],
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

function makeCd6d8266Synthesis(): SynthesisOutput {
  const s = makeValidSynthesis();
  // Extend to multiple criteria so paths match the regression fixture patterns.
  s.criteria = [
    { ...s.criteria[0], key: 'concept' },
    {
      ...s.criteria[0],
      key: 'narrativeDrive',
      final_rationale: s.criteria[0].final_rationale,
      recommendations: [
        {
          ...s.criteria[0].recommendations[0],
          candidate_text_a:
            'he re-plugged the parking meter for $6.00, wincing at both the extra cost and the time slipping away.',
          candidate_text_b:
            'he fed another $6.00 into the parking meter, doing the math on how close it was getting to dinner.',
          candidate_text_c:
            'he shoved $6.00 more into the parking meter and marched into the salon.',
        },
      ],
    },
    {
      ...s.criteria[0],
      key: 'character',
      final_rationale:
        'The narrator emerges as a flawed man. then Kim becomes a textured, compassionate stylist whose past shapes her devotion.',
    },
    {
      ...s.criteria[0],
      key: 'voice',
      fit_summary:
        "The inner commentary creates a sardonic perspective that carries readers through salon moments. The specificity of brands and 'Cost:' entries gives the narration a quasi-accounting flavor…",
    },
    {
      ...s.criteria[0],
      key: 'sceneConstruction',
      recommendations: [
        {
          ...s.criteria[0].recommendations[0],
          candidate_text_a: 'while in the car, he gave his hair a closer look.',
          candidate_text_b: 'the combination of eyebrows and hair looked wrong.',
          candidate_text_c: 'he decided to find another salon and have his eyebrows bleached.',
        },
      ],
    },
    { ...s.criteria[0], key: 'dialogue' },
    {
      ...s.criteria[0],
      key: 'theme',
      recommendations: [
        {
          ...s.criteria[0].recommendations[0],
          specific_fix:
            'Weave the value contrast between vanity and generosity into the salon-climax dialogue. then sharpen the closing image.',
        },
      ],
    },
    { ...s.criteria[0], key: 'worldbuilding' },
    {
      ...s.criteria[0],
      key: 'pacing',
      gap_summary:
        'The middle stalls during the step-by-step hair-coloring sequence, and the repeated clock-checking creates diminishing tension…',
    },
    {
      ...s.criteria[0],
      key: 'proseControl',
      recommendations: [
        { ...s.criteria[0].recommendations[0] },
        {
          ...s.criteria[0].recommendations[0],
          candidate_text_a: 'trim the second salon description to one sentence.',
          candidate_text_b: 'combine the two mirror-check beats into one.',
          candidate_text_c: 'delete the redundant cost tally in the middle.',
        },
      ],
    },
  ];
  return s;
}

function defaultMockRegenerator(
  synthesis: SynthesisOutput,
  violations: { path: string; code: string }[],
) {
  for (const v of violations) {
    const field = v.path.replace(/.*\.(?=[^.]+$)/u, '');
    const replacement =
      field === 'fit_summary'
        ? 'The voice carries the scene through concrete brand details and a self-aware accounting of costs.'
        : field === 'gap_summary'
        ? 'The middle sequence slows because the clock checks repeat without escalating tension.'
        : field === 'final_rationale'
        ? 'The narrator shows clear wants and the supporting characters each carry distinct values.'
        : 'Revise the targeted passage so the craft signal lands clearly for the reader.';
    setByPath(synthesis, v.path, replacement);
  }
}

beforeEach(() => {
  mockedRegenerateRequiredProse.mockReset();
  mockedRegenerateRequiredProse.mockImplementation(async (synthesis, violations) => {
    defaultMockRegenerator(synthesis, violations);
    return {
      ok: true,
      synthesis,
      regeneratedFields: violations.map((v) => v.path),
      failedFields: [],
      telemetry: {
        attempts: violations.length,
        regeneratedFields: violations.map((v) => v.path),
        failedFields: [],
        model: 'mock',
      },
    };
  });
});

describe('repairSynthesisIntegrity', () => {
  it('cd6d8266 regression fixture repairs fit_summary, gap_summary, final_rationale, specific_fix, and candidate_text violations', async () => {
    const synthesis = makeCd6d8266Synthesis();
    const result = await repairSynthesisIntegrity(synthesis, {
      openaiApiKey: 'test-key',
    });

    expect(result.ok).toBe(true);
    expect(result.requiredAttempts).toBeGreaterThan(0);
    expect(result.regeneratedFields).toEqual(
      expect.arrayContaining([
        'evaluation_result_v2.criteria[2].final_rationale',
        'evaluation_result_v2.criteria[3].fit_summary',
        'evaluation_result_v2.criteria[6].recommendations[0].specific_fix',
        'evaluation_result_v2.criteria[8].gap_summary',
      ]),
    );
    expect(result.remainingViolations).toHaveLength(0);
  });

  it('whole-envelope integrity test repairs multiple simultaneous required and candidate failures', async () => {
    const synthesis = makeValidSynthesis();
    synthesis.criteria[0].fit_summary = 'The voice works because the details…';
    synthesis.criteria[0].gap_summary = 'The pacing drags in the middle…';
    synthesis.criteria[0].final_rationale = 'The voice is strong. then the pacing stalls.';
    synthesis.criteria[0].recommendations[0].specific_fix = 'add a goal. then add stakes.';
    synthesis.criteria[0].recommendations[0].candidate_text_a = 'add a goal up front. make the want explicit.';
    synthesis.criteria[0].recommendations[0].candidate_text_b = 'restate the first beat. sharpen the objective.';

    const result = await repairSynthesisIntegrity(synthesis, { openaiApiKey: 'test-key' });

    expect(result.ok).toBe(true);
    expect(result.requiredAttempts).toBeGreaterThan(0);
    expect(result.candidateAttempts).toBeGreaterThan(0);
    expect(result.remainingViolations).toHaveLength(0);
  });

  it('is idempotent on an already-valid synthesis', async () => {
    const synthesis = makeValidSynthesis();
    const result = await repairSynthesisIntegrity(synthesis, { openaiApiKey: 'test-key' });

    expect(result.ok).toBe(true);
    expect(result.requiredAttempts).toBe(0);
    expect(result.candidateAttempts).toBe(0);
    expect(result.regeneratedFields).toHaveLength(0);
    expect(mockedRegenerateRequiredProse).not.toHaveBeenCalled();
  });

  it('preserves manuscript evidence and quotations unchanged', async () => {
    const synthesis = makeValidSynthesis();
    const originalEvidenceSnippet = synthesis.criteria[0].evidence[0].snippet;
    synthesis.criteria[0].fit_summary = 'The voice carries the scene because…';

    const result = await repairSynthesisIntegrity(synthesis, { openaiApiKey: 'test-key' });

    expect(result.ok).toBe(true);
    expect(synthesis.criteria[0].evidence[0].snippet).toBe(originalEvidenceSnippet);
    expect(synthesis.criteria[0].evidence[0].snippet).toContain('"Heh, I am in the top X%');
  });

  it('rejects regeneration that mutates paths outside the requested set', async () => {
    const synthesis = makeValidSynthesis();
    synthesis.criteria[0].fit_summary = 'The voice works because the details…';

    mockedRegenerateRequiredProse.mockImplementation(async (synth, violations) => {
      defaultMockRegenerator(synth, violations);
      // Illegal mutation: rewrite an unrelated field that was not requested.
      setByPath(
        synth,
        'evaluation_result_v2.criteria[0].final_rationale',
        'This field was silently overwritten by the regenerator.',
      );
      return {
        ok: true,
        synthesis: synth,
        regeneratedFields: violations.map((v) => v.path),
        failedFields: [],
        telemetry: { attempts: 1, regeneratedFields: [], failedFields: [], model: 'mock' },
      };
    });

    const result = await repairSynthesisIntegrity(synthesis, { openaiApiKey: 'test-key' });

    expect(result.ok).toBe(false);
    expect(result.remainingViolations.length).toBeGreaterThan(0);
    expect(result.telemetry.mutationBoundaryViolations).toEqual(
      expect.arrayContaining([
        'synthesis.criteria[0].final_rationale',
      ]),
    );
    // The illegal change must be reverted.
    expect(synthesis.criteria[0].final_rationale).toBe(
      'The concept is clearly present and grounded in concrete scene anchors.',
    );
  });

  it('handles mixed candidate and required violations in one recovery cycle', async () => {
    const synthesis = makeValidSynthesis();
    synthesis.criteria[0].fit_summary = 'The voice works because the details…';
    synthesis.criteria[0].recommendations[0].candidate_text_a = 'add a goal up front. make the want explicit.';

    const result = await repairSynthesisIntegrity(synthesis, { openaiApiKey: 'test-key' });

    expect(result.ok).toBe(true);
    expect(result.requiredAttempts).toBeGreaterThan(0);
    expect(result.candidateAttempts).toBeGreaterThan(0);
    expect(result.remainingViolations).toHaveLength(0);
    expect(getByPath(synthesis, 'evaluation_result_v2.criteria[0].fit_summary')).toMatch(/\.$/);
  });
});
