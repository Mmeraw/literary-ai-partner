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

import type { Pass3PreflightDraft, SinglePassOutput, SynthesisOutput } from '@/lib/evaluation/pipeline/types';
import {
  repairSynthesisIntegrity,
} from '@/lib/evaluation/pipeline/repairSynthesisIntegrity';
import * as requiredProseRegeneration from '@/lib/evaluation/pipeline/requiredProseRegeneration';
import { assertAuthorFacingIntegrity } from '@/lib/text/authorFacingIntegrity';

jest.mock('@/lib/evaluation/pipeline/requiredProseRegeneration', () => ({
  ...jest.requireActual('@/lib/evaluation/pipeline/requiredProseRegeneration'),
  regenerateRequiredProse: jest.fn(),
  regenerateCandidateProse: jest.fn(),
}));

const mockedRegenerateRequiredProse = jest.mocked(
  requiredProseRegeneration.regenerateRequiredProse,
);

const mockedRegenerateCandidateProse = jest.mocked(
  requiredProseRegeneration.regenerateCandidateProse,
);

function setByPath(obj: unknown, path: string, value: unknown): boolean {
  const normalized = path.replace(/^evaluation_result_v2\./u, '');
  const parts = normalized.split('.');
  if (parts.length === 0) return false;
  let current: unknown = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    const arrayMatch = part.match(/^([^.[]+)\[(\d+)\]$/u);
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
  const lastArrayMatch = last.match(/^([^.[]+)\[(\d+)\]$/u);
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
    const arrayMatch = part.match(/^([^.[]+)\[(\d+)\]$/u);
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

function makeYellowWallpaperSynthesis(): SynthesisOutput {
  const s = makeValidSynthesis();
  s.criteria = [
    {
      ...s.criteria[0],
      key: 'dialogue',
      recommendations: [
        {
          ...s.criteria[0].recommendations[0],
          priority: 'medium',
          action: 'Clarify the speaker attribution in the exchange.',
          expected_impact:
            'The attribution gap causes speaker intent to blur, reducing tension in the ex…',
          reader_effect: '',
          mechanism:
            'The same attribution tag on both sides flattens the conflict into a single voice.',
          specific_fix: 'Give each speaker a distinct action beat before replying.',
          candidate_text_a: '“I am not going out,” I said, “and I am not going out at all.”',
          candidate_text_b: '“I am not going out,” I said without looking up.',
          candidate_text_c: 'I shook my head. “I am not going out.”',
        },
      ],
    },
  ];
  return s;
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
        : 'Add one concrete sentence that grounds the craft signal in a specific image.';
    setByPath(synthesis, v.path, replacement);
  }
}

function defaultMockCandidateRegenerator(
  synthesis: SynthesisOutput,
  violations: { path: string; code: string }[],
) {
  for (const v of violations) {
    setByPath(synthesis, v.path, 'She adjusted the pack with steady hands before the driver looked up.');
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
      mutationBoundaryViolations: [],
      telemetry: {
        attempts: violations.length,
        regeneratedFields: violations.map((v) => v.path),
        failedFields: [],
        model: 'mock',
      },
    };
  });

  mockedRegenerateCandidateProse.mockReset();
  mockedRegenerateCandidateProse.mockImplementation(async (synthesis, violations) => {
    defaultMockCandidateRegenerator(synthesis, violations);
    return {
      ok: true,
      synthesis,
      regeneratedFields: violations.map((v) => v.path),
      failedFields: [],
      mutationBoundaryViolations: [],
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
  it('cd6d8266 regression fixture normalizes final_rationale/specific_fix/candidate_text sentence starts and repairs fit_summary and gap_summary ellipsis violations', async () => {
    const synthesis = makeCd6d8266Synthesis();
    const result = await repairSynthesisIntegrity(synthesis, {
      openaiApiKey: 'test-key',
    });

    expect(result.ok).toBe(true);
    expect(result.requiredAttempts).toBeGreaterThan(0);
    // Lowercase sentence starts are now repaired deterministically before
    // regeneration, so only the ellipsis-bearing fit_summary and gap_summary
    // require LLM regeneration.
    expect(result.regeneratedFields).toEqual(
      expect.arrayContaining([
        'evaluation_result_v2.criteria[3].fit_summary',
        'evaluation_result_v2.criteria[8].gap_summary',
      ]),
    );
    expect(result.remainingViolations).toHaveLength(0);
    expect(getByPath(synthesis, 'evaluation_result_v2.criteria[2].final_rationale')).toBe(
      'The narrator emerges as a flawed man. Then Kim becomes a textured, compassionate stylist whose past shapes her devotion.',
    );
    expect(getByPath(synthesis, 'evaluation_result_v2.criteria[6].recommendations[0].specific_fix')).toBe(
      'Weave the value contrast between vanity and generosity into the salon-climax dialogue. Then sharpen the closing image.',
    );
  });

  it('whole-envelope integrity test repairs multiple simultaneous required and candidate failures', async () => {
    const synthesis = makeValidSynthesis();
    synthesis.criteria[0].fit_summary = 'The voice works because the details…';
    synthesis.criteria[0].gap_summary = 'The pacing drags in the middle…';
    // Lowercase sentence starts are repaired deterministically by
    // normalizeArtifact before the repair loop is reached.
    synthesis.criteria[0].final_rationale = 'The voice is strong. then the pacing stalls.';
    synthesis.criteria[0].recommendations[0].specific_fix = 'add a goal. then add stakes.';
    // Ellipsis is a non-deterministic integrity violation and must flow through
    // the candidate repair path.
    synthesis.criteria[0].recommendations[0].candidate_text_a = 'add a goal up front…';
    synthesis.criteria[0].recommendations[0].candidate_text_b = 'restate the first beat. sharpen the objective.';

    const result = await repairSynthesisIntegrity(synthesis, { openaiApiKey: 'test-key' });

    expect(result.ok).toBe(true);
    expect(result.requiredAttempts).toBeGreaterThan(0);
    expect(result.candidateAttempts).toBeGreaterThan(0);
    expect(result.remainingViolations).toHaveLength(0);
    expect(synthesis.criteria[0].final_rationale).toBe('The voice is strong. Then the pacing stalls.');
    expect(synthesis.criteria[0].recommendations[0].specific_fix).toBe('Add a goal. Then add stakes.');
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
        mutationBoundaryViolations: [],
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

  it('Yellow Wallpaper regression: derived strategic_revisions[0].why maps back to its canonical source and repairs', async () => {
    const synthesis = makeYellowWallpaperSynthesis();
    const beforeSnapshot = JSON.stringify(synthesis);

    const result = await repairSynthesisIntegrity(synthesis, { openaiApiKey: 'test-key' });

    expect(result.ok).toBe(true);
    expect(result.requiredAttempts).toBeGreaterThan(0);
    // The regenerator must be asked to repair the canonical source field,
    // not the derived projection path that does not exist on SynthesisOutput.
    expect(result.regeneratedFields).toEqual(
      expect.arrayContaining([
        'evaluation_result_v2.criteria[0].recommendations[0].expected_impact',
      ]),
    );
    expect(result.remainingViolations).toHaveLength(0);

    // The regenerated source field must now be a complete sentence.
    expect(synthesis.criteria[0].recommendations[0].expected_impact).toMatch(/[.!?]["'"’)\]]*$/u);

    // Rebuilding the projection from the repaired synthesis produces no violations.
    const { buildEnrichedActionItems } = await import('@/lib/evaluation/actionItemQualityGate');
    const { inspectAuthorFacingIntegrity } = await import('@/lib/text/authorFacingIntegrity');
    const { normalizeArtifact } = await import('@/lib/evaluation/pipeline/normalizeArtifact');

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

    // All unrelated synthesis fields must be byte-identical to the original.
    // We allow only the expected_impact field to differ in this fixture.
    const original = JSON.parse(beforeSnapshot);
    expect(synthesis.criteria[0].recommendations[0].expected_impact).not.toBe(
      original.criteria[0].recommendations[0].expected_impact,
    );
    const patched = JSON.parse(JSON.stringify(synthesis));
    patched.criteria[0].recommendations[0].expected_impact =
      original.criteria[0].recommendations[0].expected_impact;
    expect(JSON.stringify(patched)).toBe(beforeSnapshot);
  });

  it('handles mixed candidate and required violations in one recovery cycle', async () => {
    const synthesis = makeValidSynthesis();
    synthesis.criteria[0].fit_summary = 'The voice works because the details…';
    // Lowercase sentence starts are repaired deterministically; ellipsis in a
    // candidate path still requires the candidate repair loop.
    synthesis.criteria[0].recommendations[0].candidate_text_a = 'add a goal up front…';

    const result = await repairSynthesisIntegrity(synthesis, { openaiApiKey: 'test-key' });

    expect(result.ok).toBe(true);
    expect(result.requiredAttempts).toBeGreaterThan(0);
    expect(result.candidateAttempts).toBeGreaterThan(0);
    expect(result.remainingViolations).toHaveLength(0);
    expect(getByPath(synthesis, 'evaluation_result_v2.criteria[0].fit_summary')).toMatch(/\.$/);
  });

  it('rejects unchanged invalid required replacements at the orchestration level', async () => {
    const synthesis = makeValidSynthesis();
    // A dangling connective cannot be papered over by Tier-1 normalization.
    synthesis.criteria[0].fit_summary = 'The voice works because';

    mockedRegenerateRequiredProse.mockImplementationOnce(async (_synth, violations) => {
      // Simulate a degenerate regenerator that claims success but leaves the
      // invalid prose unchanged.
      return {
        ok: true,
        synthesis: _synth,
        regeneratedFields: violations.map((v) => v.path),
        failedFields: [],
        mutationBoundaryViolations: [],
        telemetry: { attempts: 1, regeneratedFields: [], failedFields: [], model: 'mock' },
      };
    });

    const result = await repairSynthesisIntegrity(synthesis, {
      openaiApiKey: 'test-key',
      maxRequiredAttempts: 1,
    });

    expect(result.ok).toBe(false);
    expect(result.remainingViolations.length).toBeGreaterThan(0);
    expect(
      result.remainingViolations.some((v) =>
        v.path.includes('criteria[0].fit_summary'),
      ),
    ).toBe(true);
  });

  it('candidate quarantine cannot remove required prose', async () => {
    const synthesis = makeValidSynthesis();
    const originalFitSummary = synthesis.criteria[0].fit_summary;
    synthesis.criteria[0].recommendations[0].candidate_text_a = 'add a goal up front make the want explicit';
    synthesis.criteria[0].recommendations[0].candidate_text_b = 'restate the first beat sharpen the objective';
    synthesis.criteria[0].recommendations[0].candidate_text_c = 'reframe the opening around the want';

    const result = await repairSynthesisIntegrity(synthesis, { openaiApiKey: 'test-key' });

    expect(result.ok).toBe(true);
    expect(result.candidateAttempts).toBeGreaterThan(0);
    // Required prose on the criterion must survive candidate quarantine.
    expect(synthesis.criteria[0].fit_summary).toBe(originalFitSummary);
    expect(synthesis.criteria[0].gap_summary).toBeDefined();
    expect(synthesis.criteria[0].final_rationale).toBeDefined();
  });

  it('produces a final artifact that passes assertAuthorFacingIntegrity', async () => {
    const synthesis = makeValidSynthesis();
    synthesis.criteria[0].fit_summary = 'The voice works because the details…';
    synthesis.criteria[0].recommendations[0].candidate_text_a = 'add a goal up front. make the want explicit.';

    const result = await repairSynthesisIntegrity(synthesis, { openaiApiKey: 'test-key' });

    expect(result.ok).toBe(true);
    expect(() =>
      assertAuthorFacingIntegrity(synthesis, { rootPath: 'evaluation_result_v2' }),
    ).not.toThrow();
  });

  it('forwards provenance context to regenerateRequiredProse', async () => {
    const synthesis = makeValidSynthesis();
    synthesis.criteria[0].fit_summary = 'The voice works because the details…';

    const pass3PreflightDraft = {
      schema_version: 'pass3_preflight_draft_v1',
      pass: '3A',
      visibility: 'internal_only',
      criterionDrafts: [],
    } as unknown as Pass3PreflightDraft;

    const pass1Output = {
      pass: 1,
      axis: 'craft_execution',
      criteria: [],
      model: 'gpt-4o',
      prompt_version: 'v1',
      temperature: 0,
      generated_at: new Date().toISOString(),
    } as unknown as SinglePassOutput;

    const pass2Output = {
      pass: 2,
      axis: 'editorial_literary',
      criteria: [],
      model: 'o3',
      prompt_version: 'v1',
      temperature: 0,
      generated_at: new Date().toISOString(),
    } as unknown as SinglePassOutput;

    await repairSynthesisIntegrity(synthesis, {
      openaiApiKey: 'test-key',
      pass3PreflightDraft,
      pass1Output,
      pass2Output,
    });

    expect(mockedRegenerateRequiredProse).toHaveBeenCalled();
    const callOptions = mockedRegenerateRequiredProse.mock.calls[0][2];
    expect(callOptions.pass3PreflightDraft).toBe(pass3PreflightDraft);
    expect(callOptions.pass1Output).toBe(pass1Output);
    expect(callOptions.pass2Output).toBe(pass2Output);
  });

  it('calls targeted candidate regeneration before quarantine when candidates are invalid', async () => {
    const synthesis = makeValidSynthesis();
    synthesis.criteria[0].recommendations[0].candidate_text_a = 'add a goal up front';
    synthesis.criteria[0].recommendations[0].candidate_text_b = 'restate the first beat';
    synthesis.criteria[0].recommendations[0].candidate_text_c = 'reframe the opening';

    const result = await repairSynthesisIntegrity(synthesis, { openaiApiKey: 'test-key' });

    expect(result.ok).toBe(true);
    expect(mockedRegenerateCandidateProse).toHaveBeenCalled();
    const candidatePaths = mockedRegenerateCandidateProse.mock.calls[0][1].map((v: any) => v.path);
    expect(candidatePaths).toEqual(
      expect.arrayContaining([
        'evaluation_result_v2.criteria[0].recommendations[0].candidate_text_a',
        'evaluation_result_v2.criteria[0].recommendations[0].candidate_text_b',
        'evaluation_result_v2.criteria[0].recommendations[0].candidate_text_c',
      ]),
    );
    expect(synthesis.criteria[0].recommendations[0].candidate_text_a).toMatch(/[.!?]["'"’)\]]*$/u);
  });

  it('quarantines unresolved candidate fields after regeneration fails', async () => {
    const synthesis = makeValidSynthesis();
    synthesis.criteria[0].recommendations[0].candidate_text_a = 'add a goal up front';
    synthesis.criteria[0].recommendations[0].candidate_text_b = 'restate the first beat';

    mockedRegenerateCandidateProse.mockImplementationOnce(async (_synth, violations) => ({
      ok: false,
      synthesis: _synth,
      regeneratedFields: [],
      failedFields: violations.map((v: any) => v.path),
      mutationBoundaryViolations: [],
      telemetry: { attempts: 2, regeneratedFields: [], failedFields: violations.map((v: any) => v.path), model: 'mock' },
    }));

    const result = await repairSynthesisIntegrity(synthesis, { openaiApiKey: 'test-key' });

    expect(result.ok).toBe(true);
    expect(result.candidateAttempts).toBe(2);
    expect(result.quarantinedFields).toEqual(
      expect.arrayContaining([
        'evaluation_result_v2.criteria[0].recommendations[0].candidate_text_a',
        'evaluation_result_v2.criteria[0].recommendations[0].candidate_text_b',
      ]),
    );
    expect(synthesis.criteria[0].recommendations[0].candidate_text_a).toBeUndefined();
    expect(synthesis.criteria[0].recommendations[0].candidate_text_b).toBeUndefined();
    expect(synthesis.criteria[0].recommendations[0].candidate_text_c).toBeDefined();
  });

  it('required regeneration failure prevents certification and persistence', async () => {
    const synthesis = makeValidSynthesis();
    synthesis.criteria[0].fit_summary = 'The voice works because';

    mockedRegenerateRequiredProse.mockImplementationOnce(async (_synth, violations) => ({
      ok: false,
      synthesis: _synth,
      regeneratedFields: [],
      failedFields: violations.map((v: any) => v.path),
      mutationBoundaryViolations: [],
      telemetry: { attempts: 1, regeneratedFields: [], failedFields: violations.map((v: any) => v.path), model: 'mock' },
    }));

    const result = await repairSynthesisIntegrity(synthesis, {
      openaiApiKey: 'test-key',
      maxRequiredAttempts: 1,
    });

    expect(result.ok).toBe(false);
    expect(result.remainingViolations.length).toBeGreaterThan(0);
  });

  it('cd6d8266 fixture passes assertAuthorFacingIntegrity after required and candidate repair', async () => {
    const synthesis = makeCd6d8266Synthesis();
    const result = await repairSynthesisIntegrity(synthesis, { openaiApiKey: 'test-key' });

    expect(result.ok).toBe(true);
    expect(() =>
      assertAuthorFacingIntegrity(synthesis, { rootPath: 'evaluation_result_v2' }),
    ).not.toThrow();
  });

  it('fails closed without quarantine when candidate regeneration reports a mutation boundary breach', async () => {
    const synthesis = makeValidSynthesis();
    synthesis.criteria[0].recommendations[0].candidate_text_a = 'The protagonist reaches for the';

    const originalCandidateA = synthesis.criteria[0].recommendations[0].candidate_text_a;
    const originalCandidateB = synthesis.criteria[0].recommendations[0].candidate_text_b;

    const candidateAPath = 'evaluation_result_v2.criteria[0].recommendations[0].candidate_text_a';
    const candidateBPath = 'evaluation_result_v2.criteria[0].recommendations[0].candidate_text_b';

    mockedRegenerateCandidateProse.mockImplementationOnce(async (_synth, violations) => ({
      ok: false,
      synthesis: _synth,
      regeneratedFields: [],
      failedFields: violations.map((v: any) => v.path),
      mutationBoundaryViolations: [candidateBPath],
      telemetry: {
        attempts: 1,
        regeneratedFields: [],
        failedFields: violations.map((v: any) => v.path),
        model: 'mock',
      },
    }));

    const result = await repairSynthesisIntegrity(synthesis, { openaiApiKey: 'test-key' });

    expect(result.ok).toBe(false);
    expect(result.quarantinedFields).toEqual([]);
    expect(result.mutationBoundaryViolations).toContain(candidateBPath);
    expect(synthesis.criteria[0].recommendations[0].candidate_text_a).toBe(originalCandidateA);
    expect(synthesis.criteria[0].recommendations[0].candidate_text_b).toBe(originalCandidateB);
    expect('candidate_text_a' in synthesis.criteria[0].recommendations[0]).toBe(true);
  });
});
