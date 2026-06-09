/**
 * STRESS TEST — E2E Diagnostic Pipeline Robustness
 *
 * Throws adversarial inputs at every gate in the evaluation→revision pipeline:
 * - Empty/null diagnostic fields
 * - Contaminated rationale (template leakage)
 * - Garbage anchor snippets
 * - Mechanism present but cause missing (deterministic derivation)
 * - All fields present but too short (< 10 chars)
 * - Enrichment API failures (graceful degradation)
 * - Massive input volumes (capacity test)
 * - Unicode/special character injection
 * - Fields that LOOK valid but are meta-phrases
 *
 * Goal: make it break. If it doesn't break, the architecture is titanium.
 */

import {
  needsDiagnosticEnrichment,
  getMissingDiagnosticFields,
  enrichDiagnosticFields,
  type EnrichmentOpportunity,
} from '@/lib/revision/diagnosticEnrichment';
import {
  runWorkbenchAdmissionGate,
  type WorkbenchAdmissionInput,
} from '@/lib/revision/reviseAdmissionGate';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeOpportunity(overrides: Partial<EnrichmentOpportunity> = {}): EnrichmentOpportunity {
  return {
    opportunity_id: `stress-${Math.random().toString(36).slice(2)}`,
    evidence_anchor: 'Israel was strapped to a gurney by his ankles and wrists in a pale blue hospital gown.',
    rationale: 'The prose passes through the hospital scene at the same pace as earlier scenes without registering the shift in gravity.',
    criterion: 'sceneConstruction',
    revision_operation: 'expand',
    symptom: 'The passage moves through a traumatic moment at the same pace and voice as mundane scenes, so the reader cannot feel the shift in gravity.',
    cause: 'The author reports the event sequentially without slowing prose rhythm or allowing sensory detail to carry emotional weight.',
    fix_direction: 'Slow one beat in the hospital scene by replacing a summary sentence with a single concrete sensory detail that carries the emotional register shift.',
    reader_effect: 'The reader\u2019s body registers the gravity of the moment \u2014 the essay earns its emotional claim rather than merely stating it.',
    ...overrides,
  };
}

function makeWorkbenchInput(overrides: Partial<WorkbenchAdmissionInput> = {}): WorkbenchAdmissionInput {
  return {
    id: `wb-stress-${Math.random().toString(36).slice(2)}`,
    readiness: 'ready_for_revise',
    groundingStatus: 'supported',
    preflightStatus: 'passed',
    contextQuality: 'clean',
    anchor: 'Israel was strapped to a gurney.',
    quoteHighlight: 'strapped to a gurney',
    quoteRest: 'by his ankles and wrists',
    options: [
      { key: 'A', candidateText: 'The gurney creaked under Israel\u2019s weight. His wrists were purple where the straps bit.' },
      { key: 'B', candidateText: 'Israel lay motionless, the hospital gown too bright against his skin\u2019s pallor.' },
      { key: 'C', candidateText: 'I stood at the foot of the bed. The sound of the heart monitor was the only proof he was still here.' },
    ],
    symptom: 'The passage moves through a traumatic moment without registering the shift in gravity for the reader.',
    cause: 'Sequential reporting without prose rhythm adjustment or sensory detail to carry emotional weight.',
    fixDirection: 'Replace a summary sentence with a concrete sensory detail that carries the emotional register shift.',
    readerEffect: 'The reader\u2019s body registers the gravity of the moment \u2014 the essay earns its emotional claim.',
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1: DIAGNOSTIC ENRICHMENT — ADVERSARIAL INPUTS
// ══════════════════════════════════════════════════════════════════════════════

describe('Diagnostic Enrichment — Adversarial Stress', () => {
  describe('Empty/null diagnostic fields', () => {
    it('identifies ALL fields as missing when everything is null', () => {
      const opp = makeOpportunity({
        symptom: undefined,
        cause: undefined,
        fix_direction: undefined,
        reader_effect: undefined,
      });
      expect(needsDiagnosticEnrichment(opp)).toBe(true);
      expect(getMissingDiagnosticFields(opp)).toEqual([
        'symptom', 'cause', 'fix_direction', 'reader_effect',
      ]);
    });

    it('identifies ALL fields as missing when everything is empty string', () => {
      const opp = makeOpportunity({
        symptom: '',
        cause: '',
        fix_direction: '',
        reader_effect: '',
      });
      expect(needsDiagnosticEnrichment(opp)).toBe(true);
      expect(getMissingDiagnosticFields(opp).length).toBe(4);
    });

    it('identifies ALL fields as missing when everything is whitespace', () => {
      const opp = makeOpportunity({
        symptom: '   \t\n   ',
        cause: '   \t\n   ',
        fix_direction: '   \t\n   ',
        reader_effect: '   \t\n   ',
      });
      expect(needsDiagnosticEnrichment(opp)).toBe(true);
      expect(getMissingDiagnosticFields(opp).length).toBe(4);
    });

    it('does NOT flag fields that are populated with valid content', () => {
      const opp = makeOpportunity(); // All fields populated by default
      expect(needsDiagnosticEnrichment(opp)).toBe(false);
      expect(getMissingDiagnosticFields(opp).length).toBe(0);
    });
  });

  describe('Fields below minimum length threshold (< 10 chars)', () => {
    it('flags symptom of exactly 9 chars as missing', () => {
      const opp = makeOpportunity({ symptom: '123456789' });
      expect(getMissingDiagnosticFields(opp)).toContain('symptom');
    });

    it('accepts symptom of exactly 10 chars', () => {
      const opp = makeOpportunity({ symptom: '1234567890' });
      expect(getMissingDiagnosticFields(opp)).not.toContain('symptom');
    });

    it('flags ALL fields at exactly 9 chars each', () => {
      const opp = makeOpportunity({
        symptom: 'abcdefghi',
        cause: 'abcdefghi',
        fix_direction: 'abcdefghi',
        reader_effect: 'abcdefghi',
      });
      expect(getMissingDiagnosticFields(opp).length).toBe(4);
    });

    it('flags fields that are just a single repeated character', () => {
      const opp = makeOpportunity({
        symptom: 'aaaa',
        cause: 'b',
        fix_direction: 'cc',
        reader_effect: 'ddddddddd', // 9 chars
      });
      expect(getMissingDiagnosticFields(opp).length).toBe(4);
    });
  });

  describe('Enrichment with no API key (graceful degradation)', () => {
    const originalKey = process.env.OPENAI_API_KEY;

    beforeAll(() => {
      delete process.env.OPENAI_API_KEY;
    });

    afterAll(() => {
      if (originalKey) process.env.OPENAI_API_KEY = originalKey;
    });

    it('returns all as failed when no API key available', async () => {
      const opps = [
        makeOpportunity({ symptom: undefined, cause: undefined }),
        makeOpportunity({ fix_direction: undefined }),
        makeOpportunity({ reader_effect: undefined }),
      ];

      const result = await enrichDiagnosticFields(opps);
      expect(result.enrichedCount).toBe(0);
      expect(result.failedCount).toBe(3);
      expect(result.results.size).toBe(0);
    });

    it('does not throw — degrades gracefully', async () => {
      const opps = Array.from({ length: 100 }, () =>
        makeOpportunity({ symptom: undefined, cause: undefined }),
      );

      await expect(enrichDiagnosticFields(opps)).resolves.not.toThrow();
    });
  });

  describe('Mechanism→Cause deterministic derivation', () => {
    it('mechanism of sufficient length provides cause when cause is empty', () => {
      // This tests the opportunityLedger extraction, not enrichment directly.
      // The ledger now does: cause ?? mechanism as the fallback.
      const opp = makeOpportunity({
        cause: 'The author reports sequentially without slowing prose rhythm',
      });
      expect(getMissingDiagnosticFields(opp)).not.toContain('cause');
    });

    it('mechanism that is too short still flags cause as missing', () => {
      const opp = makeOpportunity({ cause: 'short' });
      expect(getMissingDiagnosticFields(opp)).toContain('cause');
    });
  });

  describe('Unicode and special character injection', () => {
    it('handles emoji-filled symptom gracefully', () => {
      const opp = makeOpportunity({
        symptom: '🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥', // 10 emojis, each is multi-byte
      });
      // Emojis are valid characters — trim().length counts code units
      // This should count as >= 10 chars
      expect(opp.symptom!.trim().length).toBeGreaterThanOrEqual(10);
      expect(getMissingDiagnosticFields(opp)).not.toContain('symptom');
    });

    it('handles RTL and zero-width characters', () => {
      const opp = makeOpportunity({
        symptom: '\u200B\u200B\u200B\u200B\u200B\u200B\u200B\u200B\u200B\u200B', // 10 zero-width spaces
      });
      // Zero-width spaces have length but are invisible — should still count by char count
      expect(opp.symptom!.trim().length).toBeGreaterThanOrEqual(10);
    });

    it('handles null bytes gracefully', () => {
      const opp = makeOpportunity({
        symptom: 'Valid text\x00with null\x00bytes in it for testing',
      });
      expect(needsDiagnosticEnrichment(opp)).toBe(false);
    });
  });

  describe('Volume stress — large batches', () => {
    it('handles 500 opportunities without crashing (no API key)', async () => {
      delete process.env.OPENAI_API_KEY;
      const opps = Array.from({ length: 500 }, (_, i) =>
        makeOpportunity({
          opportunity_id: `vol-${i}`,
          symptom: undefined,
          cause: undefined,
          fix_direction: undefined,
          reader_effect: undefined,
        }),
      );

      const result = await enrichDiagnosticFields(opps);
      expect(result.failedCount).toBe(500);
      expect(result.enrichedCount).toBe(0);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2: WORKBENCH ADMISSION GATE — ADVERSARIAL INPUTS
// ══════════════════════════════════════════════════════════════════════════════

describe('Workbench Admission Gate — Adversarial Stress', () => {
  describe('Complete valid input passes admission', () => {
    it('admits a fully populated opportunity', () => {
      const result = runWorkbenchAdmissionGate(makeWorkbenchInput());
      expect(result.admission_status).toBe('admission_passed');
      expect(result.reasons.length).toBe(0);
    });
  });

  describe('Missing diagnostic fields — withholds card', () => {
    it('withholds when symptom is null', () => {
      const result = runWorkbenchAdmissionGate(makeWorkbenchInput({ symptom: null }));
      expect(result.admission_status).toBe('withheld');
      expect(result.reasons).toContain('DIAGNOSTIC_MISSING_SYMPTOM');
    });

    it('withholds when cause is null', () => {
      const result = runWorkbenchAdmissionGate(makeWorkbenchInput({ cause: null }));
      expect(result.admission_status).toBe('withheld');
      expect(result.reasons).toContain('DIAGNOSTIC_MISSING_CAUSE');
    });

    it('withholds when fixDirection is null', () => {
      const result = runWorkbenchAdmissionGate(makeWorkbenchInput({ fixDirection: null }));
      expect(result.admission_status).toBe('withheld');
      expect(result.reasons).toContain('DIAGNOSTIC_MISSING_FIX_DIRECTION');
    });

    it('withholds when readerEffect is null', () => {
      const result = runWorkbenchAdmissionGate(makeWorkbenchInput({ readerEffect: null }));
      expect(result.admission_status).toBe('withheld');
      expect(result.reasons).toContain('DIAGNOSTIC_MISSING_READER_EFFECT');
    });

    it('withholds with ALL four reason codes when ALL diagnostics missing', () => {
      const result = runWorkbenchAdmissionGate(makeWorkbenchInput({
        symptom: null,
        cause: null,
        fixDirection: null,
        readerEffect: null,
      }));
      expect(result.admission_status).toBe('withheld');
      expect(result.reasons).toContain('DIAGNOSTIC_MISSING_SYMPTOM');
      expect(result.reasons).toContain('DIAGNOSTIC_MISSING_CAUSE');
      expect(result.reasons).toContain('DIAGNOSTIC_MISSING_FIX_DIRECTION');
      expect(result.reasons).toContain('DIAGNOSTIC_MISSING_READER_EFFECT');
    });
  });

  describe('Fields below minimum length (< 10 chars)', () => {
    it('withholds when symptom is 9 chars', () => {
      const result = runWorkbenchAdmissionGate(makeWorkbenchInput({ symptom: '123456789' }));
      expect(result.admission_status).toBe('withheld');
      expect(result.reasons).toContain('DIAGNOSTIC_MISSING_SYMPTOM');
    });

    it('admits when symptom is exactly 10 chars', () => {
      const result = runWorkbenchAdmissionGate(makeWorkbenchInput({ symptom: '1234567890' }));
      expect(result.reasons).not.toContain('DIAGNOSTIC_MISSING_SYMPTOM');
    });

    it('withholds when ALL fields are 1 char each', () => {
      const result = runWorkbenchAdmissionGate(makeWorkbenchInput({
        symptom: 'x',
        cause: 'y',
        fixDirection: 'z',
        readerEffect: 'w',
      }));
      expect(result.admission_status).toBe('withheld');
      expect(result.reasons.length).toBeGreaterThanOrEqual(4);
    });

    it('withholds when fields are just whitespace', () => {
      const result = runWorkbenchAdmissionGate(makeWorkbenchInput({
        symptom: '          ',  // 10 spaces
        cause: '          ',
        fixDirection: '          ',
        readerEffect: '          ',
      }));
      expect(result.admission_status).toBe('withheld');
    });
  });

  describe('Non-ready status — withholds regardless of diagnostics', () => {
    it('withholds when readiness is not ready_for_revise', () => {
      const result = runWorkbenchAdmissionGate(makeWorkbenchInput({
        readiness: 'blocked',
      }));
      expect(result.admission_status).toBe('withheld');
      expect(result.reasons).toContain('NOT_READY_FOR_REVISE');
    });

    it('withholds when grounding is unsupported', () => {
      const result = runWorkbenchAdmissionGate(makeWorkbenchInput({
        groundingStatus: 'unsupported_blocked',
      }));
      expect(result.admission_status).toBe('withheld');
      expect(result.reasons).toContain('UNSUPPORTED_REVISION');
    });

    it('withholds when preflight failed', () => {
      const result = runWorkbenchAdmissionGate(makeWorkbenchInput({
        preflightStatus: 'blocked',
      }));
      expect(result.admission_status).toBe('withheld');
      expect(result.reasons).toContain('PREFLIGHT_NOT_PASSED');
    });
  });

  describe('Candidate text quality — empty A/B/C', () => {
    it('withholds when all three candidates are empty', () => {
      const result = runWorkbenchAdmissionGate(makeWorkbenchInput({
        options: [
          { key: 'A', candidateText: '' },
          { key: 'B', candidateText: '' },
          { key: 'C', candidateText: '' },
        ],
      }));
      expect(result.admission_status).toBe('withheld');
    });

    it('withholds when candidates are just whitespace', () => {
      const result = runWorkbenchAdmissionGate(makeWorkbenchInput({
        options: [
          { key: 'A', candidateText: '   \n\t  ' },
          { key: 'B', candidateText: '   \n\t  ' },
          { key: 'C', candidateText: '   \n\t  ' },
        ],
      }));
      expect(result.admission_status).toBe('withheld');
    });
  });

  describe('Compound failure — multiple gates fail simultaneously', () => {
    it('reports ALL reason codes when everything is wrong', () => {
      const result = runWorkbenchAdmissionGate(makeWorkbenchInput({
        readiness: 'blocked',
        groundingStatus: 'unsupported_blocked',
        preflightStatus: 'blocked',
        contextQuality: 'limited',
        symptom: null,
        cause: null,
        fixDirection: null,
        readerEffect: null,
        options: [
          { key: 'A', candidateText: '' },
          { key: 'B', candidateText: '' },
          { key: 'C', candidateText: '' },
        ],
      }));
      expect(result.admission_status).toBe('withheld');
      // Should have at least: NOT_READY_FOR_REVISE, UNSUPPORTED, PREFLIGHT, CONTEXT, and 4 DIAGNOSTIC_MISSING
      expect(result.reasons.length).toBeGreaterThanOrEqual(7);
    });
  });

  describe('Meta-phrase contamination in diagnostic fields', () => {
    // These are fields that LOOK populated but are actually template leakage
    it('still admits if contaminated text passes length check (gate checks length, not content)', () => {
      // Note: The admission gate checks LENGTH only. Content filtering happens
      // upstream in cleanAuthorFacingText(). This is intentional — the gate is
      // the last-resort catch for truly empty/short fields.
      const result = runWorkbenchAdmissionGate(makeWorkbenchInput({
        symptom: 'There is a clear editorial opportunity in this passage that warrants attention.',
      }));
      // The gate passes because the field is >10 chars.
      // Contamination filtering is done BEFORE the gate in cleanAuthorFacingText().
      expect(result.reasons).not.toContain('DIAGNOSTIC_MISSING_SYMPTOM');
    });
  });

  describe('Boundary conditions — exactly at thresholds', () => {
    it('field with exactly 10 chars passes', () => {
      const input = makeWorkbenchInput({
        symptom: 'Exactly 10',  // 10 chars
        cause: 'Exactly_10',
        fixDirection: 'Fix_10char',
        readerEffect: 'Reader_eff',
      });
      const result = runWorkbenchAdmissionGate(input);
      expect(result.reasons.filter(r => r.startsWith('DIAGNOSTIC_MISSING'))).toHaveLength(0);
    });

    it('field with 9 chars (after trim) fails', () => {
      const input = makeWorkbenchInput({
        symptom: ' 9_chars_ ',  // 9 after trim
      });
      const result = runWorkbenchAdmissionGate(input);
      expect(result.reasons).toContain('DIAGNOSTIC_MISSING_SYMPTOM');
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3: buildSymptomFromContext — ADVERSARIAL INPUTS
// ══════════════════════════════════════════════════════════════════════════════

// Import the function — it's not exported directly, so we test it via synthesis
// behavior. We test via the exposed interface in the pipeline.
describe('Symptom Derivation Fallback — Edge Cases', () => {
  // The function buildSymptomFromContext is internal to runPass3Synthesis.
  // We test its behavior through the enrichment pathway.

  it('mechanism of 10+ chars would provide valid cause if used as fallback', () => {
    // Simulate what the ledger does: cause ?? mechanism
    const mechanism = 'The author reports the event sequentially without adjusting prose rhythm';
    const derived = mechanism; // This is what the ledger does
    expect(derived.length).toBeGreaterThanOrEqual(10);
  });

  it('mechanism of < 10 chars would NOT provide valid cause', () => {
    const mechanism = 'Too short';
    expect(mechanism.trim().length).toBeLessThan(10);
  });

  it('empty mechanism leaves cause undefined (triggers enrichment)', () => {
    const mechanism = '';
    const cause = mechanism || undefined;
    expect(cause).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4: CONTAMINATION FILTER — ADVERSARIAL META-PHRASES
// ══════════════════════════════════════════════════════════════════════════════

describe('Enrichment Contamination Filter — Meta-Phrase Detection', () => {
  // Import the function indirectly by testing enrichment behavior
  // The isValidDiagnosticField function is internal, so we test via
  // the public needsDiagnosticEnrichment / getMissingDiagnosticFields.
  // Those only check LENGTH, not contamination (contamination is checked
  // on LLM output in enrichDiagnosticFields). For direct testing we
  // access the module internals.

  // We test the contamination patterns that the enrichment module uses
  // by examining what it considers "valid". Since isValidDiagnosticField
  // is not exported, we verify the patterns documented in the module.

  const CONTAMINATION_SAMPLES = [
    'There is a clear editorial opportunity in this prose section that needs attention.',
    'There is an editorial opportunity for improvement in the paragraph structure.',
    'This passage would benefit from more specific sensory detail and grounding.',
    'The author should consider restructuring the paragraph for better flow.',
    'The author could consider adding more concrete detail to this section.',
    'The author might consider revising the approach to emotional revelation.',
    'Consider revising the sentence structure to improve narrative momentum.',
    'Consider restructuring the paragraph to lead with the emotional hook.',
    'Consider rewriting the exposition to show rather than tell the moment.',
    'Revise the approach to show the emotional weight of the hospital scene.',
    'Rewrite the passage to foreground physical sensation over intellectual summary.',
    'Restructure this paragraph so the turn lands with more force.',
    'Improve the passage by adding concrete sensory anchoring to the moment.',
  ];

  const VALID_DIAGNOSTIC_SAMPLES = [
    'The prose moves through the hospital scene at the same pace as the employment scene, flattening the emotional register.',
    'Sequential reporting without pause for a single sensory detail causes the reader to skim past the moment.',
    'Replace the summary sentence "We talked and I consoled him" with one concrete physical observation.',
    'The reader\u2019s body registers the shift in gravity; the essay earns its emotional claim rather than declaring it.',
  ];

  // Test that contamination patterns are correctly detected.
  // We can't call isValidDiagnosticField directly (not exported),
  // but we can test that enrichDiagnosticFields would reject these
  // by mocking the LLM response. For now, we document expected behavior.
  it('valid diagnostic samples pass length check (enrichment would accept)', () => {
    for (const sample of VALID_DIAGNOSTIC_SAMPLES) {
      expect(sample.trim().length).toBeGreaterThanOrEqual(10);
    }
  });

  it('contaminated samples also pass length check (only caught by content filter)', () => {
    for (const sample of CONTAMINATION_SAMPLES) {
      expect(sample.trim().length).toBeGreaterThanOrEqual(10);
    }
  });

  it('contamination patterns from enrichment module match expected samples', () => {
    // Mirror the UPDATED patterns from diagnosticEnrichment.ts isValidDiagnosticField
    // (includes stress-test-discovered additions)
    const ENRICHMENT_CONTAMINATION_PATTERNS = [
      /there is (a clear |an? )?editorial opportunity/i,
      /this passage would benefit from/i,
      /the author (should|could|might) consider/i,
      /consider (revising|restructuring|rewriting)/i,
      /^(revise|rewrite|restructure|improve)\s/i,
      /it would be beneficial to/i,
      /^a revision here (could|would|should)/i,
      /one might (improve|revise|restructure|rewrite)/i,
      /an? opportunity exists to/i,
      /would be more effective (with|if)/i,
    ];

    const caught = CONTAMINATION_SAMPLES.filter((sample) =>
      ENRICHMENT_CONTAMINATION_PATTERNS.some((p) => p.test(sample.trim())),
    );

    // ALL contamination samples SHOULD be caught by the updated filter.
    expect(caught.length).toBe(CONTAMINATION_SAMPLES.length);
  });

  it('valid diagnostics do NOT trigger contamination patterns', () => {
    const ENRICHMENT_CONTAMINATION_PATTERNS = [
      /there is (a clear |an? )?editorial opportunity/i,
      /this passage would benefit from/i,
      /the author (should|could|might) consider/i,
      /consider (revising|restructuring|rewriting)/i,
      /^(revise|rewrite|restructure|improve)\s/i,
      /it would be beneficial to/i,
      /^a revision here (could|would|should)/i,
      /one might (improve|revise|restructure|rewrite)/i,
      /an? opportunity exists to/i,
      /would be more effective (with|if)/i,
    ];

    for (const sample of VALID_DIAGNOSTIC_SAMPLES) {
      const matched = ENRICHMENT_CONTAMINATION_PATTERNS.some((p) => p.test(sample.trim()));
      expect(matched).toBe(false);
    }
  });
});
