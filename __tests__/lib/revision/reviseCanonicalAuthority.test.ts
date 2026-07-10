/**
 * Authority-conflict regression suite.
 *
 * Guards the architectural contract established after the "Let the River Decide"
 * long-form evaluation surfaced only 10 Revise opportunities instead of the full
 * canonical set:
 *
 *   canonicalOpportunityLedger.opportunities   (authoritative supply)
 *     ├── report projection  -> rendered_opportunities (curated, capped 7/10 by
 *     │                          capRenderedOpportunities — a display concern)
 *     └── Revise projection   -> full canonical opportunities, independently capped
 *                                by the 50/100 Revise-queue policy
 *                                (getReviseQueueMaxOpportunities / capRevisionOpportunities)
 *
 * The defect being regression-locked: the Revise extraction previously read
 * `rendered_opportunities` (already truncated to 10) instead of the full
 * `opportunities` array, so the tested 50/100 queue policy could never bind.
 */

import {
  projectCanonicalRevisionOpportunities,
  extractCanonicalRevisionOpportunities,
  getReviseQueueMaxOpportunities,
  REVISE_QUEUE_MAX_SHORT_FORM,
  REVISE_QUEUE_MAX_LONG_FORM,
  REVISE_QUEUE_LONG_FORM_WORD_THRESHOLD,
} from '@/lib/revision/opportunityLedger';
import { buildCanonicalOpportunityLedger } from '@/lib/evaluation/canonicalOpportunityLedger';

const LONG_FORM_WORDS = 84_007; // Let the River Decide
const SHORT_FORM_WORDS = 5_000;
const SOURCE_HASH = 'test-ued-hash';

type CanonicalItem = Record<string, unknown>;

/** Build a single canonical opportunity item in the shape the UED stores. */
function makeCanonicalOpportunity(
  index: number,
  severity: 'high' | 'medium' | 'low' = 'medium',
): CanonicalItem {
  return {
    id: `OPP-${String(index).padStart(3, '0')}`,
    primary_criterion: 'scene_craft',
    severity,
    evidence: `Mara set the lantern on the dock rail and watched the river take issue ${index} downstream.`,
    location: `chapter:${index}`,
    symptom: `The causal beat at passage ${index} is suppressed beneath surface motion.`,
    cause: `The prose advances without grounding the consequence for issue ${index}.`,
    fix_direction: `Surface the implication before the next beat for issue ${index}.`,
    action: `Repair issue ${index} with manuscript-specific prose.`,
    reader_effect: `The reader re-anchors in scene logic at issue ${index}.`,
    candidate_text_a: `Mara held the rail for issue ${index}, letting the current answer first.`,
  };
}

/** Assemble a UED-shaped document with independent report + canonical arrays. */
function makeUnifiedDocument(params: {
  canonicalCount: number;
  renderedCount: number;
  severityCycle?: Array<'high' | 'medium' | 'low'>;
  omitCanonical?: boolean;
}): unknown {
  const cycle = params.severityCycle ?? ['medium'];
  const canonical: CanonicalItem[] = Array.from({ length: params.canonicalCount }, (_, i) =>
    makeCanonicalOpportunity(i + 1, cycle[i % cycle.length]),
  );
  // rendered is the curated report subset (first N) — a DIFFERENT array.
  const rendered = canonical.slice(0, params.renderedCount);

  const ledger: Record<string, unknown> = { rendered_opportunities: rendered };
  if (!params.omitCanonical) ledger.opportunities = canonical;

  return { canonicalOpportunityLedger: ledger };
}

describe('Revise canonical authority contract', () => {
  it('feeds the FULL canonical set into Revise, not the curated rendered array (21 canonical / 10 rendered -> 21)', () => {
    // Mirrors the Let the River Decide artifact: 21 canonical, 10 rendered.
    const ued = makeUnifiedDocument({ canonicalCount: 21, renderedCount: 10 });
    const result = projectCanonicalRevisionOpportunities(ued, SOURCE_HASH, LONG_FORM_WORDS);

    expect(result.sourceMode).toBe('canonical_full');
    expect(result.canonicalCount).toBe(21);
    expect(result.renderedCount).toBe(10);
    // The whole point: Revise receives 21, NOT the truncated 10.
    expect(result.opportunities).toHaveLength(21);
  });

  it('applies the long-form 100 cap when canonical supply exceeds it (>100 -> 100)', () => {
    const ued = makeUnifiedDocument({ canonicalCount: 137, renderedCount: 10 });
    const result = projectCanonicalRevisionOpportunities(ued, SOURCE_HASH, LONG_FORM_WORDS);

    expect(getReviseQueueMaxOpportunities(LONG_FORM_WORDS)).toBe(REVISE_QUEUE_MAX_LONG_FORM);
    expect(result.opportunities).toHaveLength(REVISE_QUEUE_MAX_LONG_FORM); // 100
  });

  it('applies the short-form 50 cap when canonical supply exceeds it (>50 -> 50)', () => {
    const ued = makeUnifiedDocument({ canonicalCount: 73, renderedCount: 10 });
    const result = projectCanonicalRevisionOpportunities(ued, SOURCE_HASH, SHORT_FORM_WORDS);

    expect(getReviseQueueMaxOpportunities(SHORT_FORM_WORDS)).toBe(REVISE_QUEUE_MAX_SHORT_FORM);
    expect(result.opportunities).toHaveLength(REVISE_QUEUE_MAX_SHORT_FORM); // 50
  });

  it('honors the exact long-form word threshold boundary (24,999 -> 50, 25,000 -> 100)', () => {
    expect(getReviseQueueMaxOpportunities(REVISE_QUEUE_LONG_FORM_WORD_THRESHOLD - 1)).toBe(50);
    expect(getReviseQueueMaxOpportunities(REVISE_QUEUE_LONG_FORM_WORD_THRESHOLD)).toBe(100);
  });

  it('stamps Revise provenance as canonicalOpportunityLedger.opportunities (not rendered_opportunities)', () => {
    const ued = makeUnifiedDocument({ canonicalCount: 5, renderedCount: 5 });
    const result = projectCanonicalRevisionOpportunities(ued, SOURCE_HASH, LONG_FORM_WORDS);

    expect(result.opportunities.length).toBeGreaterThan(0);
    for (const opp of result.opportunities) {
      expect(opp.provenance).toBe(
        'unified_evaluation_document_v1.canonicalOpportunityLedger.opportunities',
      );
      expect(opp.provenance).not.toContain('rendered_opportunities');
    }
  });

  it('orders opportunities deterministically by severity when the cap binds', () => {
    // 120 long-form items cycling must/should/could -> cap 100 must keep the
    // highest-severity items first, and the ordering must be stable across runs.
    const severityCycle: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low'];
    const ued = makeUnifiedDocument({ canonicalCount: 120, renderedCount: 10, severityCycle });

    const runA = projectCanonicalRevisionOpportunities(ued, SOURCE_HASH, LONG_FORM_WORDS);
    const runB = projectCanonicalRevisionOpportunities(ued, SOURCE_HASH, LONG_FORM_WORDS);

    expect(runA.opportunities).toHaveLength(100);

    const rank: Record<string, number> = { must: 0, should: 1, could: 2 };
    for (let i = 1; i < runA.opportunities.length; i += 1) {
      expect(rank[runA.opportunities[i].severity]).toBeGreaterThanOrEqual(
        rank[runA.opportunities[i - 1].severity],
      );
    }
    // Determinism: identical id ordering across two independent projections.
    expect(runA.opportunities.map((o) => o.opportunity_id)).toEqual(
      runB.opportunities.map((o) => o.opportunity_id),
    );
  });

  describe('legacy degraded fallback', () => {
    it('flags artifacts missing .opportunities as legacy_rendered_degraded (never silently the normal path)', () => {
      const ued = makeUnifiedDocument({
        canonicalCount: 10,
        renderedCount: 10,
        omitCanonical: true, // legacy artifact: only rendered_opportunities exists
      });

      const extraction = extractCanonicalRevisionOpportunities(ued);
      expect(extraction.sourceMode).toBe('legacy_rendered_degraded');
      expect(extraction.canonicalCount).toBe(0);
      expect(extraction.renderedCount).toBe(10);
      expect(extraction.items).toHaveLength(10);

      const result = projectCanonicalRevisionOpportunities(ued, SOURCE_HASH, LONG_FORM_WORDS);
      // Fallback still supplies opportunities, but is explicitly marked degraded.
      expect(result.sourceMode).toBe('legacy_rendered_degraded');
      expect(result.opportunities).toHaveLength(10);
    });

    it('returns empty for a document with neither array', () => {
      const extraction = extractCanonicalRevisionOpportunities({
        canonicalOpportunityLedger: {},
      });
      expect(extraction.items).toHaveLength(0);
      expect(extraction.sourceMode).toBe('canonical_full');
      expect(extraction.canonicalCount).toBe(0);
      expect(extraction.renderedCount).toBe(0);
    });
  });

  describe('report projection stays curated (capRenderedOpportunities is preserved)', () => {
    it('keeps rendered_opportunities <= 10 for long-form while opportunities holds the full set', () => {
      // Build 30 quote-shaped recommendations that are lexically DISTINCT (distinct
      // named entities, settings, and evidence) so the report builder's dedup does
      // not collapse them. This yields a large canonical set but a capped rendered set.
      const names = [
        'Mara', 'Tomas', 'Fritz', 'Nila', 'Schultz', 'Elena', 'Cormac', 'Isadora',
        'Bram', 'Priya', 'Dorian', 'Yusuf', 'Greta', 'Silas', 'Anouk', 'Rafferty',
        'Petra', 'Django', 'Marisol', 'Osric', 'Freya', 'Callum', 'Zaid', 'Lorna',
        'Emeric', 'Sunny', 'Barnaby', 'Wren', 'Casimir', 'Delphine',
      ];
      const places = [
        'the flooded dock', 'the granary loft', 'the frozen orchard', 'the tin chapel',
        'the coal siding', 'the salt marsh', 'the customs house', 'the lantern bridge',
        'the mill race', 'the widow\'s stair', 'the harbor gate', 'the ropewalk',
        'the powder magazine', 'the drovers\' road', 'the reeve\'s hall',
      ];
      const recommendations = Array.from({ length: 30 }, (_, i) => {
        const name = names[i];
        const place = places[i % places.length];
        return {
          action: `Tighten how ${name} confronts the reversal near ${place} in chapter ${i + 1}.`,
          symptom: `${name}'s turn at ${place} reads flat because the motive is withheld too long.`,
          anchor_snippet: `${name} paused at ${place} while the ${i + 1}th bell counted out the hour.`,
          specific_fix: `Plant ${name}'s stake at ${place} one beat earlier so the reversal lands.`,
          manuscript_coordinates: `chapter:${i + 1}`,
          issue_family: `craft_${i + 1}`,
          priority: (i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low') as
            | 'high'
            | 'medium'
            | 'low',
          expected_impact: `Sharpens ${name}'s arc through ${place}.`,
        };
      });

      const ledger = buildCanonicalOpportunityLedger({
        metrics: { manuscript: { word_count: LONG_FORM_WORDS } },
        criteria: [{ key: 'scene_craft', recommendations }],
      });

      // Report display stays curated (<= 10 for long-form).
      expect(ledger.rendered_opportunities.length).toBeLessThanOrEqual(10);
      // Full canonical supply is materially larger than the report display.
      expect(ledger.opportunities.length).toBeGreaterThan(ledger.rendered_opportunities.length);

      // And when that full ledger flows into Revise, all of it is available
      // (well under the 100 long-form cap here).
      const result = projectCanonicalRevisionOpportunities(
        { canonicalOpportunityLedger: ledger },
        SOURCE_HASH,
        LONG_FORM_WORDS,
      );
      expect(result.sourceMode).toBe('canonical_full');
      expect(result.opportunities.length).toBe(ledger.opportunities.length);
      expect(result.opportunities.length).toBeGreaterThan(ledger.rendered_opportunities.length);
    });
  });
});
