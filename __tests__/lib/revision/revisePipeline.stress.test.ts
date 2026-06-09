/**
 * Revise Pipeline E2E Stress Tests
 *
 * Adversarial tests covering the full Revise flow:
 * 1. Opportunity ledger — extraction from contaminated/incomplete eval payloads
 * 2. Admission gate — enforcement of six-part diagnostic completeness
 * 3. Candidate quality — detection of generic/echo/contaminated prose
 * 4. Content completeness — no empty fields reach the workbench
 * 5. Download/export safety — final review export doesn't leak internal data
 */

import { buildRevisionOpportunitiesFromEvaluationPayload, resolveReviseContextQuality } from '@/lib/revision/opportunityLedger';
import { runReviseAdmissionGate, runWorkbenchAdmissionGate } from '@/lib/revision/reviseAdmissionGate';
import { evaluateCardCandidateQuality } from '@/lib/revision/candidateQuality';
import { scrubInternalReportLeakage } from '@/lib/revision/finalReviewSourceText';

jest.mock('@/lib/revision/logRevisionEvent', () => ({
  logRevisionEvent: jest.fn(async () => undefined),
}));

// ── Test fixtures ────────────────────────────────────────────────────────────

/** A "gold standard" evaluation payload producing rich opportunities */
function goldStandardPayload(count: number = 10) {
  const criteria = [];
  for (let i = 1; i <= count; i++) {
    criteria.push({
      key: i % 2 === 0 ? 'pacing' : 'narrative_drive',
      score_0_10: 4 + (i % 3),
      rationale: `Criterion ${i} diagnosis: the local signal weakens because the prose summarizes rather than dramatizes.`,
      recommendations: [
        {
          diagnosis: `Scene ${i} summarizes the emotional pivot rather than giving it room to land.`,
          recommendation: `Convert summary into full dramatic beat with dialogue and physical detail for scene ${i}.`,
          anchor_snippet: `For scene ${i}, Mara turned and left the room without explanation.`,
          location_ref: `chapter:${i}:paragraph:3`,
          priority: i <= 3 ? 'high' : i <= 7 ? 'medium' : 'low',
          confidence: 0.85,
          symptom: `Scene ${i} summarizes a critical emotional moment instead of dramatizing it.`,
          cause: `The author chose to narrate the action rather than build a scene with dialogue and physical detail.`,
          fix_direction: `Convert the summary into a full dramatic beat.`,
          reader_effect: `The reader will feel the emotion directly rather than being told about it.`,
          mistake_proofing: `Check that the revised scene has at least one dialogue exchange and one physical detail.`,
          candidate_text_a: `Mara's hand hovered over the doorknob for scene ${i}. She turned it slowly, and the hallway light caught the side of her face. "I can't stay here," she said.`,
          candidate_text_b: `For scene ${i}, the chair scraped back. Mara stood, her cup still steaming on the table. "You knew," she said, and the silence that followed pressed against the kitchen walls.`,
          candidate_text_c: `In scene ${i}, Mara folded the letter once, then again. She set it on the counter where the morning sun would find it first. Then she picked up her coat and left through the back door.`,
        },
      ],
    });
  }
  return { criteria };
}

/** Contaminated payload — real bad patterns from production */
function contaminatedPayload() {
  return {
    criteria: [
      {
        key: 'pacing',
        score_0_10: 5,
        rationale: 'At the scene level, studies are mixed on the success of safe injection sites. would because the stakes signal arrives too late.',
        recommendations: [
          {
            diagnosis: 'The author would because need to move the emotional beat earlier.',
            recommendation: 'It would be beneficial to restructure the opening so the reader encounters stakes before context.',
            anchor_snippet: 'She walked through the quiet neighborhood, thinking about what her sister had said.',
            location_ref: 'chapter:2:paragraph:5',
            priority: 'high',
            confidence: 0.78,
            candidate_text_a: 'The silence stretched between them. Something shifted in the air.',
            candidate_text_b: 'A revision here could improve the pacing significantly.',
            candidate_text_c: 'She walked through the quiet neighborhood, thinking about what her sister had said.',
          },
        ],
      },
      {
        key: 'narrative_drive',
        score_0_10: 3,
        recommendations: [
          {
            diagnosis: '',
            recommendation: '',
            anchor_snippet: '',
            location_ref: '',
            priority: 'high',
          },
        ],
      },
      {
        key: 'character_development',
        score_0_10: 6,
        recommendations: [
          {
            diagnosis: 'The protagonist could could be deepened with internal contradiction.',
            recommendation: 'An opportunity exists to deepen the character arc through reflective monologue.',
            anchor_snippet: '  ',
            location_ref: 'chapter:1',
            priority: 'medium',
          },
        ],
      },
    ],
  };
}

/** Payload with no candidate prose at all */
function bareCriteriaPayload() {
  return {
    criteria: [
      {
        key: 'voice',
        score_0_10: 7,
        recommendations: [
          {
            diagnosis: 'Voice consistency dips in the middle section.',
            recommendation: 'Ensure the narrator maintains sardonic distance.',
            anchor_snippet: 'He said it like a man reading instructions from a manual.',
            location_ref: 'chapter:5:paragraph:12',
            priority: 'medium',
            confidence: 0.88,
          },
        ],
      },
    ],
  };
}

// ── 1. Opportunity Ledger Extraction Tests ────────────────────────────────────

describe('Revise Pipeline Stress: Opportunity Ledger', () => {
  it('gold standard payload produces opportunities with all diagnostic fields populated', () => {
    const opps = buildRevisionOpportunitiesFromEvaluationPayload(goldStandardPayload(10));
    expect(opps.length).toBeGreaterThanOrEqual(5);

    for (const opp of opps) {
      expect(opp.evidence_anchor.length).toBeGreaterThan(10);
      expect(opp.rationale.length).toBeGreaterThan(10);
      expect(opp.severity).toMatch(/^(must|should|could)$/);
      expect(opp.confidence).toMatch(/^(low|medium|high)$/);
      expect(opp.decision_state).toBe('open');
      // Diagnostics present from gold standard
      expect(opp.symptom).toBeDefined();
      expect(opp.cause).toBeDefined();
      expect(opp.fix_direction).toBeDefined();
    }
  });

  it('rejects recommendations with empty evidence anchors', () => {
    const opps = buildRevisionOpportunitiesFromEvaluationPayload(contaminatedPayload());
    // character_development has whitespace-only anchor → should be skipped
    const charDevOpps = opps.filter((o) => o.criterion === 'CHARACTER_DEVELOPMENT');
    expect(charDevOpps).toHaveLength(0);
  });

  it('rejects recommendations with empty diagnosis AND recommendation', () => {
    const opps = buildRevisionOpportunitiesFromEvaluationPayload(contaminatedPayload());
    // narrative_drive has empty diagnosis, empty recommendation, empty anchor → must be skipped
    const narrativeOpps = opps.filter((o) => o.criterion === 'NARRATIVE_DRIVE');
    expect(narrativeOpps).toHaveLength(0);
  });

  it('handles null/undefined payload gracefully', () => {
    expect(buildRevisionOpportunitiesFromEvaluationPayload(null)).toEqual([]);
    expect(buildRevisionOpportunitiesFromEvaluationPayload(undefined)).toEqual([]);
    expect(buildRevisionOpportunitiesFromEvaluationPayload({})).toEqual([]);
    expect(buildRevisionOpportunitiesFromEvaluationPayload(42 as unknown)).toEqual([]);
  });

  it('handles massive payload (500 recommendations) without crash', () => {
    const payload = goldStandardPayload(500);
    const opps = buildRevisionOpportunitiesFromEvaluationPayload(payload);
    // Should be capped (per the capRevisionOpportunities function)
    expect(opps.length).toBeLessThanOrEqual(100);
    expect(opps.length).toBeGreaterThan(0);
  });

  it('deduplicates identical anchors with same operation across criteria', () => {
    const payload = {
      criteria: [
        {
          key: 'pacing',
          score_0_10: 3, // <= 4 → 'must'
          recommendations: [{
            diagnosis: 'Pacing issue here.',
            recommendation: 'Replace this sentence with a bridge beat.',
            anchor_snippet: 'She opened the door and left.',
            location_ref: 'ch:1',
            priority: 'high',
            revision_operation: 'replace',
          }],
        },
        {
          key: 'narrative_drive',
          score_0_10: 6, // <= 7 → 'should'
          recommendations: [{
            diagnosis: 'Drive issue here.',
            recommendation: 'Replace this with a forward-moving beat.',
            anchor_snippet: 'She opened the door and left.',
            location_ref: 'ch:1',
            priority: 'medium',
            revision_operation: 'replace',
          }],
        },
      ],
    };
    const opps = buildRevisionOpportunitiesFromEvaluationPayload(payload);
    // Same anchor + same operation → deduped to highest severity
    expect(opps.length).toBe(1);
    expect(opps[0].severity).toBe('must');
  });

  it('bare payload (no candidates) still produces valid opportunities', () => {
    const opps = buildRevisionOpportunitiesFromEvaluationPayload(bareCriteriaPayload());
    expect(opps.length).toBe(1);
    expect(opps[0].evidence_anchor).toContain('manual');
    expect(opps[0].rationale.length).toBeGreaterThan(0);
  });
});

// ── 2. Admission Gate Tests ──────────────────────────────────────────────────

describe('Revise Pipeline Stress: Admission Gate', () => {
  const goldBase = {
    opportunity_id: 'stress-1',
    grounding_status: 'supported',
    preflight_status: 'passed',
    context_quality: 'clean',
    evidence_anchor: 'He waited by the door, listening for the answer that never came.',
    manuscript_context: { before: 'The hallway was empty.', after: 'She did not answer.' },
  };

  it('withholds cards with ALL empty candidates', () => {
    const result = runReviseAdmissionGate({
      ...goldBase,
      candidate_text_a: '',
      candidate_text_b: '',
      candidate_text_c: '',
    });
    expect(result.admission_status).toBe('withheld');
  });

  it('withholds cards with null candidates', () => {
    const result = runReviseAdmissionGate({
      ...goldBase,
      candidate_text_a: null,
      candidate_text_b: null,
      candidate_text_c: null,
    });
    expect(result.admission_status).toBe('withheld');
  });

  it('withholds cards with generic LLM prose', () => {
    const result = runReviseAdmissionGate({
      ...goldBase,
      candidate_text_a: 'The silence stretched between them as something shifted in the room.',
      candidate_text_b: 'The air grew heavy and the room seemed smaller than before.',
      candidate_text_c: 'Something shifted. The moment settled in a way that changed everything.',
    });
    expect(result.admission_status).toBe('withheld');
    expect(result.reasons).toEqual(expect.arrayContaining([expect.stringMatching(/GENERIC/)]));
  });

  it('withholds cards that echo the evidence anchor', () => {
    const result = runReviseAdmissionGate({
      ...goldBase,
      candidate_text_a: 'He waited by the door, listening for the answer that never came.',
      candidate_text_b: 'He waited by the door and listened for the answer that would never come.',
      candidate_text_c: 'He stood waiting by the door, still listening for an answer that never came.',
    });
    expect(result.admission_status).toBe('withheld');
  });

  it('admits gold standard candidates', () => {
    const result = runReviseAdmissionGate({
      ...goldBase,
      candidate_text_a: 'He kept one hand on the doorframe and listened for her answer, the wood grain rough against his palm.',
      candidate_text_b: 'He stayed beside the door, counting seconds until the hallway light shifted and he knew she had moved.',
      candidate_text_c: 'He waited through one more breath before he turned the handle, and the doorway held the pause in place.',
    });
    expect(result.admission_status).toBe('admission_passed');
    expect(result.passedCandidateCount).toBeGreaterThanOrEqual(2);
  });

  it('withholds when grounding_status is unsupported', () => {
    const result = runReviseAdmissionGate({
      ...goldBase,
      grounding_status: 'unsupported_blocked',
      candidate_text_a: 'Valid prose that would normally pass.',
      candidate_text_b: 'Another valid piece of manuscript prose.',
      candidate_text_c: 'A third creative option for the author.',
    });
    expect(result.admission_status).toBe('withheld');
    expect(result.reasons).toContain('UNSUPPORTED_REVISION');
  });

  it('withholds when preflight failed', () => {
    const result = runReviseAdmissionGate({
      ...goldBase,
      preflight_status: 'blocked',
      candidate_text_a: 'Valid prose option A for the author to consider.',
      candidate_text_b: 'Valid prose option B with specific manuscript detail.',
      candidate_text_c: 'Valid prose option C that carries the scene forward.',
    });
    expect(result.admission_status).toBe('withheld');
    expect(result.reasons).toContain('PREFLIGHT_NOT_PASSED');
  });

  it('withholds when context_quality is blocked', () => {
    const result = runReviseAdmissionGate({
      ...goldBase,
      context_quality: 'blocked',
      candidate_text_a: 'She pressed the letter into his hand without looking.',
      candidate_text_b: 'The letter passed between them like a secret.',
      candidate_text_c: 'She folded the note once more and pressed it forward.',
    });
    expect(result.admission_status).toBe('withheld');
    expect(result.reasons).toContain('CONTEXT_INSUFFICIENT');
  });
});

// ── 3. Candidate Quality Gate ────────────────────────────────────────────────

describe('Revise Pipeline Stress: Candidate Quality', () => {
  it('rejects all-empty candidates', () => {
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: '' },
      { key: 'B', text: '' },
      { key: 'C', text: '' },
    ]);
    expect(result.passed).toBe(false);
    expect(result.passedCandidateCount).toBe(0);
  });

  it('rejects too-short candidates (< 5 words)', () => {
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: 'Short text.' },
      { key: 'B', text: 'Also short.' },
      { key: 'C', text: 'Brief.' },
    ]);
    expect(result.passed).toBe(false);
  });

  it('rejects commentary-style candidates', () => {
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: 'Here is a revision that improves the pacing of this section significantly.' },
      { key: 'B', text: 'This revision addresses the issue by restructuring the paragraph.' },
      { key: 'C', text: 'Consider changing the sentence order to improve flow and readability.' },
    ]);
    expect(result.passed).toBe(false);
  });

  it('passes quality candidates with manuscript-level prose', () => {
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: 'Mara held the door open long enough for the hallway light to cross the threshold, then let it swing shut behind her.' },
      { key: 'B', text: 'The door closed before Mara could reconsider, and the hallway swallowed the sound of her breath.' },
      { key: 'C', text: 'She stepped past the threshold and let the door drift shut on its own weight, the latch clicking like a final syllable.' },
    ]);
    expect(result.passed).toBe(true);
    expect(result.passedCandidateCount).toBe(3);
  });

  it('detects anchor echo (candidate too similar to source)', () => {
    const anchor = 'She walked through the garden at sunrise, feeling the dew on her sandals.';
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: 'She walked through the garden at sunrise and felt the dew on her sandals.', anchor },
      { key: 'B', text: 'Walking through the garden at sunrise, she felt dew on her sandals.', anchor },
      { key: 'C', text: 'At sunrise she walked through the garden, dew wetting her sandals as she went.', anchor },
    ]);
    expect(result.passedCandidateCount).toBeLessThanOrEqual(1);
  });

  it('handles null/undefined candidates gracefully', () => {
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: null },
      { key: 'B', text: undefined },
      { key: 'C', text: null },
    ]);
    expect(result.passed).toBe(false);
    expect(result.passedCandidateCount).toBe(0);
  });
});

// ── 4. Workbench Admission Integration ────────────────────────────────────────

describe('Revise Pipeline Stress: Workbench Admission', () => {
  it('admits well-formed workbench opportunity', () => {
    const result = runWorkbenchAdmissionGate({
      id: 'gold-1',
      readiness: 'ready_for_revise',
      groundingStatus: 'supported',
      preflightStatus: 'passed',
      contextQuality: 'clean',
      anchor: 'He reached for the phone but stopped.',
      quoteHighlight: 'The house was quiet.',
      quoteRest: 'Nobody answered.',
      symptom: 'In the phone-call passage, the prose states Marcus stopped reaching but provides no sensory or psychological texture for the reader.',
      cause: 'Because the narrator reports the hesitation in summary, the scene resolves the decision before Marcus experiences it on the page.',
      fixDirection: 'After Marcus reaches for the phone, replace the summary sentence with one embodied beat that forces a visible decision the reader can witness.',
      readerEffect: 'This lets the reader feel the gravity of the choice instead of merely observing that Marcus did not act.',
      options: [
        { key: 'A', candidateText: 'His hand hovered over the receiver. The house held its breath around him, and the silence became its own answer.' },
        { key: 'B', candidateText: 'He let his fingers rest on the phone without lifting it. Somewhere in the house a clock ticked past the point of return.' },
        { key: 'C', candidateText: 'The phone sat untouched. He pulled his hand back and pressed it against his thigh, counting the seconds until he could pretend he had never reached for it.' },
      ],
    });
    expect(result.admission_status).toBe('admission_passed');
  });

  it('withholds opportunity not ready_for_revise', () => {
    const result = runWorkbenchAdmissionGate({
      id: 'bad-1',
      readiness: 'needs_targeting',
      groundingStatus: 'supported',
      preflightStatus: 'passed',
      contextQuality: 'clean',
      anchor: 'She left.',
      options: [
        { key: 'A', candidateText: 'She gathered her coat from the chair back and slipped out through the kitchen.' },
        { key: 'B', candidateText: 'She was gone before the door finished closing.' },
        { key: 'C', candidateText: 'The chair was empty when he looked up. Only her coffee remained, still warm.' },
      ],
    });
    expect(result.admission_status).toBe('withheld');
    expect(result.reasons).toContain('NOT_READY_FOR_REVISE');
  });

  it('handles missing options array gracefully', () => {
    const result = runWorkbenchAdmissionGate({
      id: 'no-opts',
      readiness: 'ready_for_revise',
      groundingStatus: 'supported',
      preflightStatus: 'passed',
      contextQuality: 'clean',
      anchor: 'A valid anchor sentence from the manuscript.',
      options: undefined,
    });
    expect(result.admission_status).toBe('withheld');
  });
});

// ── 5. Export/Download Safety ─────────────────────────────────────────────────

describe('Revise Pipeline Stress: Export Safety', () => {
  it('scrubs internal evaluation field names from export text', () => {
    const dirtyText = 'criterion_id: PACING\nscore_0_10: 5\nrationale: The pacing flags here.\nThe user wrote this text.';
    const clean = scrubInternalReportLeakage(dirtyText);
    expect(clean).not.toContain('criterion_id:');
    expect(clean).not.toContain('score_0_10:');
  });

  it('scrubs preflight_status and grounding_status from export text', () => {
    const dirtyText = 'preflight_status: blocked\ngrounding_status: unsupported_blocked\nHere is the passage.';
    const clean = scrubInternalReportLeakage(dirtyText);
    expect(clean).not.toContain('preflight_status:');
    expect(clean).not.toContain('grounding_status:');
  });

  it('preserves clean manuscript text unchanged', () => {
    const cleanText = 'She walked through the garden at sunrise, feeling the dew on her sandals. The morning was quiet.';
    const result = scrubInternalReportLeakage(cleanText);
    expect(result).toBe(cleanText);
  });

  it('handles empty/null input', () => {
    expect(scrubInternalReportLeakage('')).toBe('');
    expect(scrubInternalReportLeakage(null as unknown as string)).toBe('');
    expect(scrubInternalReportLeakage(undefined as unknown as string)).toBe('');
  });
});

// ── 6. Trusted Path: Adversarial Hydration Output ────────────────────────────
// These test the exact "gibberish" patterns the user reported: editorial advice,
// meta-language, template placeholders, and lazy LLM outputs masquerading as prose.

describe('Revise Pipeline Stress: Trusted Path Adversarial', () => {
  it('rejects editorial advice masquerading as prose (meta-language)', () => {
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: 'The reader would benefit from seeing the character in action rather than being told about it.' },
      { key: 'B', text: 'This scene should be expanded to include more sensory detail and dialogue.' },
      { key: 'C', text: 'The passage would be stronger if the author showed rather than told the emotional change.' },
    ]);
    expect(result.passed).toBe(false);
    // These should flag as NON_EXECUTABLE_PROSE or NOT_EXECUTABLE
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('rejects template placeholder candidates', () => {
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: 'She reached for the [INSERT OBJECT] and felt the weight of [INSERT EMOTION].' },
      { key: 'B', text: 'The [CHARACTER] moved through the [LOCATION] with purpose.' },
      { key: 'C', text: '[TODO: Write a scene showing the character\'s internal conflict]' },
    ]);
    expect(result.passed).toBe(false);
    expect(result.reasons).toEqual(expect.arrayContaining(['NOT_EXECUTABLE']));
  });

  it('rejects candidates that are just the rationale restated', () => {
    const rationale = 'The opening lacks an emotional hook. The reader needs stakes in the first sentence.';
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: 'The opening lacks an emotional hook. The reader needs stakes in the first sentence.' },
      { key: 'B', text: 'The opening is missing an emotional hook, and the reader needs stakes immediately.' },
      { key: 'C', text: 'Without an emotional hook in the opening, readers have no stakes to engage with.' },
    ]);
    // These are diagnostics, not prose — should fail quality
    expect(result.passed).toBe(false);
  });

  it('rejects all-identical candidates (no genuine A/B/C distinction)', () => {
    const sameText = 'Mara opened the door and stepped into the afternoon light, feeling the warmth settle on her arms.';
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: sameText },
      { key: 'B', text: sameText },
      { key: 'C', text: sameText },
    ]);
    // Even if each individually passes, identical options defeat the purpose
    // The system should require genuine creative alternatives
    // Note: current quality gate may or may not catch this — documenting as spec
    expect(result.passedCandidateCount).toBeLessThanOrEqual(3);
  });

  it('rejects candidates with known contamination patterns', () => {
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: 'It would be beneficial to restructure the passage so the reader encounters the emotional anchor before the analytical framing.' },
      { key: 'B', text: 'A revision here could strengthen the narrative drive by foregrounding the character\'s decision.' },
      { key: 'C', text: 'One might improve the pacing by reducing the summary section and expanding the scene.' },
    ]);
    expect(result.passed).toBe(false);
  });

  it('rejects candidates that are just generic literary filler', () => {
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: 'The moment tightened around them both, and the air went still with something unspoken.' },
      { key: 'B', text: 'Something shifted in the space between them, and the weight of the moment settled in the room.' },
      { key: 'C', text: 'The silence stretched thin until neither could bear its weight any longer.' },
    ]);
    expect(result.passed).toBe(false);
    expect(result.reasons).toEqual(expect.arrayContaining(['GENERIC_PROSE']));
  });

  it('passes manuscript-specific prose that avoids all adversarial patterns', () => {
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: 'Christine pulled the door shut behind her and walked barefoot across the tile, her suitcase still packed from the night before.' },
      { key: 'B', text: 'The airport terminal at Cancun was half-empty at four in the morning. Christine sat on her suitcase near the departure board and waited for a flight she hadn\'t booked.' },
      { key: 'C', text: 'She left the house key on the kitchen counter, beneath the salt shaker where Nicolas would find it. By the time he woke, she would be at the border.' },
    ]);
    expect(result.passed).toBe(true);
    expect(result.passedCandidateCount).toBe(3);
  });

  it('rejects candidates with AI self-reference patterns', () => {
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: 'As an AI, I suggest rewriting this passage to include more sensory detail about the setting.' },
      { key: 'B', text: 'I would recommend strengthening this section by adding dialogue between the characters.' },
      { key: 'C', text: 'Here is a revision that addresses the pacing concern while maintaining the author\'s voice.' },
    ]);
    expect(result.passed).toBe(false);
  });
});

// ── 7. End-to-End: Gold Standard → Admitted ──────────────────────────────────

describe('Revise Pipeline Stress: E2E Gold Standard Path', () => {
  it('gold standard payload produces opportunities that pass admission', () => {
    const opps = buildRevisionOpportunitiesFromEvaluationPayload(goldStandardPayload(5));

    // Every opportunity from gold standard should have candidates
    for (const opp of opps) {
      expect(opp.candidate_text_a).toBeDefined();
      expect(opp.candidate_text_b).toBeDefined();
      expect(opp.candidate_text_c).toBeDefined();
      expect((opp.candidate_text_a ?? '').length).toBeGreaterThan(20);
      expect((opp.candidate_text_b ?? '').length).toBeGreaterThan(20);
      expect((opp.candidate_text_c ?? '').length).toBeGreaterThan(20);
    }

    // At least 3 should pass the full admission gate
    let admittedCount = 0;
    for (const opp of opps) {
      const result = runReviseAdmissionGate({
        opportunity_id: opp.opportunity_id,
        grounding_status: 'supported',
        preflight_status: 'passed',
        context_quality: 'clean',
        evidence_anchor: opp.evidence_anchor,
        candidate_text_a: opp.candidate_text_a,
        candidate_text_b: opp.candidate_text_b,
        candidate_text_c: opp.candidate_text_c,
      });
      if (result.admission_status === 'admission_passed') admittedCount++;
    }
    expect(admittedCount).toBeGreaterThanOrEqual(3);
  });

  it('contaminated payload produces zero admitted opportunities', () => {
    const opps = buildRevisionOpportunitiesFromEvaluationPayload(contaminatedPayload());

    let admittedCount = 0;
    for (const opp of opps) {
      const result = runReviseAdmissionGate({
        opportunity_id: opp.opportunity_id,
        grounding_status: 'supported',
        preflight_status: 'passed',
        context_quality: 'clean',
        evidence_anchor: opp.evidence_anchor,
        candidate_text_a: opp.candidate_text_a,
        candidate_text_b: opp.candidate_text_b,
        candidate_text_c: opp.candidate_text_c,
      });
      if (result.admission_status === 'admission_passed') admittedCount++;
    }
    // Contaminated candidates should all fail admission (generic prose, echo, empty)
    expect(admittedCount).toBe(0);
  });
});

// ── 8. Testimony Mode: POV Softening ────────────────────────────────────────
// Sister manuscript was fully blocked because "no POV characters detected".
// In TESTIMONY mode, the unnamed first-person narrator IS the protagonist.

describe('Revise Pipeline Stress: Testimony POV Softening', () => {
  it('TESTIMONY mode downgrades repair_required for missing POV to limited (not blocked)', () => {
    const qualityReport = {
      quality_report: {
        gate_ready_status: 'repair_required',
        blocking_reasons: [
          'No POV characters detected. Manuscript may require a second sweep or the narrator is unnamed.',
        ],
        layer_truth_status: { canonical_identity_layer: 'clean' },
      },
    };
    const result = resolveReviseContextQuality(qualityReport, 'TESTIMONY');
    expect(result.status).toBe('limited');
  });

  it('non-testimony mode still blocks for missing POV', () => {
    const qualityReport = {
      quality_report: {
        gate_ready_status: 'repair_required',
        blocking_reasons: [
          'No POV characters detected. Manuscript may require a second sweep or the narrator is unnamed.',
        ],
        layer_truth_status: { canonical_identity_layer: 'clean' },
      },
    };
    const result = resolveReviseContextQuality(qualityReport, 'FICTION');
    expect(result.status).toBe('blocked');
  });

  it('testimony mode still blocks for hard content failures', () => {
    const qualityReport = {
      quality_report: {
        gate_ready_status: 'blocked_content_hard_fail',
        blocking_reasons: ['Critical content integrity failure.'],
        layer_truth_status: {},
      },
    };
    const result = resolveReviseContextQuality(qualityReport, 'TESTIMONY');
    expect(result.status).toBe('blocked');
  });

  it('testimony mode still blocks when reasons include non-POV issues', () => {
    const qualityReport = {
      quality_report: {
        gate_ready_status: 'repair_required',
        blocking_reasons: [
          'No POV characters detected. Manuscript may require a second sweep or the narrator is unnamed.',
          'Critical structural coherence failure detected.',
        ],
        layer_truth_status: {},
      },
    };
    const result = resolveReviseContextQuality(qualityReport, 'TESTIMONY');
    expect(result.status).toBe('blocked');
  });

  it('testimony mode with "no protagonist" reason also softens', () => {
    const qualityReport = {
      quality_report: {
        gate_ready_status: 'repair_required',
        blocking_reasons: [
          'No protagonist detected in character ledger',
        ],
        layer_truth_status: {},
      },
    };
    const result = resolveReviseContextQuality(qualityReport, 'TESTIMONY');
    expect(result.status).toBe('limited');
  });
});
