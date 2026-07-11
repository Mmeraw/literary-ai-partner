import {
  anchorRationaleIsCoherent,
  buildAnchorCoherenceDiagnostic,
} from '@/lib/revision/opportunityLedger';

/**
 * PR A — anchor coherence category-error fix.
 *
 * The prior preflight heuristic equated "the rationale reuses tokens from the anchor"
 * with "the recommendation is coherently anchored to the passage". That assumption is a
 * category error: valid abstract editorial recommendations (Marketability, Concept,
 * Theme, Voice, Dialogue) naturally share few or no tokens with the verbatim manuscript
 * quote, so the gate wrongly emitted `anchor_mismatch` and blocked them.
 *
 * These fixtures are the FIVE real opportunities that "Let the River Decide"
 * (job 9ee70f12-1e8d-4729-9163-5eb9845b70b1) blocked with anchor_mismatch. All five have
 * ~0 lexical overlap between anchor and rationale yet are genuinely anchored. They must now
 * be ADMITTED. Intentionally unrelated / evidence-less pairs must still be REJECTED so the
 * safety gate is preserved.
 */

type LedgerOpportunityLike = Parameters<typeof anchorRationaleIsCoherent>[0];

function makeOpportunity(overrides: Partial<LedgerOpportunityLike>): LedgerOpportunityLike {
  return {
    opportunity_id: 'OPP-TEST',
    criterion: 'PACING',
    severity: 'should',
    rationale: '',
    evidence_anchor: '',
    manuscript_coordinates: 'chunk-1',
    provenance: 'test',
    confidence: 'medium',
    decision_state: 'open',
    revision_operation: 'replace_selected_passage',
    ...overrides,
  } as LedgerOpportunityLike;
}

// The five real anchor_mismatch false-positives from Let the River Decide.
const REAL_FALSE_POSITIVES: Array<Partial<LedgerOpportunityLike>> = [
  {
    opportunity_id: 'OPP-004',
    criterion: 'MARKETABILITY',
    evidence_anchor:
      '\u201cLocation: Billy Landing \u2192 Stonepine Flats, Northwest Territories (NWT) July 14, 2025\u201d',
    rationale:
      'Adjust query letters, back-cover copy, and metadata to highlight the book\u2019s literary and environmental focus, using comparables from eco-fiction and Indigenous-centered literary suspense rather than procedural crime novels.',
    fix_direction:
      'Adjust query letters, back-cover copy, and metadata to highlight the book\u2019s literary and environmental focus, using comparables from eco-fiction and Indigenous-centered literary suspense rather than procedural crime novels.',
    reader_effect:
      'Readers who pick up the book will be more likely to appreciate its actual strengths\u2014voice, theme, and worldbuilding\u2014rather than judging it against thriller templates it does not aim to follow.',
  },
  {
    opportunity_id: 'OPP-006',
    criterion: 'VOICE',
    evidence_anchor:
      '\u201cyear, after decades of travel with the Canadian Forces, the aerospace company I worked for, and my wanderlust, I found my oasis: Bucaramanga Golf and Country Club in Colombia.\u201d',
    rationale:
      'Replace one or two generic lines about danger and disappearance with a recollection that shows Mike and, if plausible, Cliff or a dog navigating a specific incident at Bucaramanga.',
    fix_direction:
      'Replace one or two generic lines about danger and disappearance with a recollection that shows Mike and, if plausible, Cliff or a dog navigating a specific incident at Bucaramanga.',
    reader_effect:
      'Readers will feel they are being confided in by a particular person rather than addressed by an essayist, deepening trust in the voice during complex thematic material.',
  },
  {
    opportunity_id: 'OPP-007',
    criterion: 'DIALOGUE',
    evidence_anchor: '\u201cs trying to do both\u2014sacred stewardship and national necessity.\u201d',
    rationale:
      'Replace one explanatory sentence with a line in which William or Anthony names a river reach they lost, or a ritual Smokehouse Camp can no longer safely hold, tying the law\u2019s abstraction to concrete loss.',
    fix_direction:
      'Replace one explanatory sentence with a line in which William or Anthony names a river reach they lost, or a ritual Smokehouse Camp can no longer safely hold, tying the law\u2019s abstraction to concrete loss.',
    reader_effect:
      'Readers will sense the emotional cost behind the policy jargon, making them more invested in the characters\u2019 positions and less likely to skim dense dialogue.',
  },
  {
    opportunity_id: 'OPP-008',
    criterion: 'CONCEPT',
    evidence_anchor: 'What if Calder weren\u2019t missing? What if he\u2019d been marked? Same as us.',
    rationale:
      'sharpen the premise hook by grounding one abstract concept in a concrete dramatic question the reader must see answered',
    fix_direction:
      'sharpen the premise hook by grounding one abstract concept in a concrete dramatic question the reader must see answered',
    reader_effect:
      'sharper premise intrigue and a clearer dramatic question that compels the reader forward',
  },
  {
    opportunity_id: 'OPP-010',
    criterion: 'THEME',
    evidence_anchor: 'What if he\u2019d been marked? Same as us.',
    rationale: 'replace one abstract thematic statement with a concrete image or action that embodies the theme',
    fix_direction: 'replace one abstract thematic statement with a concrete image or action that embodies the theme',
    reader_effect: 'stronger thematic resonance and payoff at the scene turn',
  },
];

describe('anchor coherence gate — PR A category-error fix', () => {
  describe('admits valid abstract recommendations with ~0 lexical overlap', () => {
    for (const fixture of REAL_FALSE_POSITIVES) {
      it(`admits ${fixture.opportunity_id} (${fixture.criterion})`, () => {
        const opp = makeOpportunity(fixture);
        const diagnostic = buildAnchorCoherenceDiagnostic(opp);

        // These are the exact pairs the old lexical-overlap heuristic wrongly blocked.
        expect(diagnostic.lexical_overlap).toBeLessThan(0.05);
        expect(diagnostic.valid_anchor).toBe(true);
        expect(diagnostic.concrete_action).toBe(true);
        expect(diagnostic.coherent_fix_or_effect).toBe(true);
        expect(diagnostic.decision).toBe('admitted');
        expect(anchorRationaleIsCoherent(opp)).toBe(true);
      });
    }
  });

  describe('preserves the safety gate — still rejects genuinely incoherent pairs', () => {
    it('rejects an opportunity with no manuscript anchor', () => {
      const opp = makeOpportunity({
        criterion: 'PACING',
        evidence_anchor: '',
        rationale: 'tighten the scene to raise stakes',
        fix_direction: 'tighten the scene to raise stakes and compress exposition',
      });
      const diagnostic = buildAnchorCoherenceDiagnostic(opp);
      expect(diagnostic.valid_anchor).toBe(false);
      expect(diagnostic.decision).toBe('rejected_incoherent');
      expect(anchorRationaleIsCoherent(opp)).toBe(false);
    });

    it('rejects an opportunity with a valid anchor but no concrete action or fix/effect', () => {
      const opp = makeOpportunity({
        criterion: 'PACING',
        evidence_anchor: '\u201cThe river ran cold that morning near Billy Landing.\u201d',
        rationale: 'note',
        fix_direction: '',
        reader_effect: '',
        revision_operation: 'needs_targeting',
      });
      const diagnostic = buildAnchorCoherenceDiagnostic(opp);
      expect(diagnostic.valid_anchor).toBe(true);
      expect(diagnostic.concrete_action).toBe(false);
      expect(diagnostic.coherent_fix_or_effect).toBe(false);
      expect(diagnostic.decision).toBe('rejected_incoherent');
      expect(anchorRationaleIsCoherent(opp)).toBe(false);
    });

    it('rejects an opportunity missing a recognized criterion', () => {
      const opp = makeOpportunity({
        criterion: '',
        evidence_anchor: '\u201cThe river ran cold that morning near Billy Landing.\u201d',
        rationale: 'consider revising',
        fix_direction: 'tighten the scene to raise stakes and sharpen momentum',
      });
      const diagnostic = buildAnchorCoherenceDiagnostic(opp);
      expect(diagnostic.criterion).toBe('');
      expect(diagnostic.decision).toBe('rejected_incoherent');
      expect(anchorRationaleIsCoherent(opp)).toBe(false);
    });
  });

  describe('lexical overlap remains an independent path to admission', () => {
    it('admits when anchor and rationale genuinely share vocabulary', () => {
      const opp = makeOpportunity({
        criterion: 'PACING',
        evidence_anchor: 'The smokehouse camp fire burned through the cold northern night.',
        rationale: 'Tighten the smokehouse camp fire description to sharpen the northern night pacing.',
        fix_direction: 'Tighten the smokehouse camp fire description to sharpen the northern night pacing.',
      });
      const diagnostic = buildAnchorCoherenceDiagnostic(opp);
      expect(diagnostic.lexical_overlap).toBeGreaterThanOrEqual(0.05);
      expect(diagnostic.decision).toBe('admitted');
    });
  });

  describe('structured diagnostic is self-describing', () => {
    it('records every decision input and a human-readable reason', () => {
      const opp = makeOpportunity(REAL_FALSE_POSITIVES[0]);
      const diagnostic = buildAnchorCoherenceDiagnostic(opp);
      expect(diagnostic.check).toBe('anchor_coherence');
      expect(diagnostic).toEqual(
        expect.objectContaining({
          lexical_overlap: expect.any(Number),
          criterion: 'MARKETABILITY',
          concrete_action: true,
          valid_anchor: true,
          structural_target: expect.any(Boolean),
          coherent_fix_or_effect: true,
          decision: 'admitted',
          reason: expect.stringContaining('Admitted'),
        }),
      );
    });
  });
});
