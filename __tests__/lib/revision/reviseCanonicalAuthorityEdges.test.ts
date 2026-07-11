import {
  extractCanonicalRevisionOpportunities,
  projectCanonicalRevisionOpportunities,
} from '@/lib/revision/opportunityLedger';

const renderedOpportunity = {
  id: 'rendered-1',
  primary_criterion: 'Narrative Drive & Momentum',
  severity: 'medium',
  evidence: 'A rendered-only evidence anchor.',
  fix_direction: 'Tighten the transition.',
  location: 'Chapter 2',
};

describe('Revise canonical authority edge cases', () => {
  it('does not silently downgrade when canonical opportunities are present but empty', () => {
    const extraction = extractCanonicalRevisionOpportunities({
      canonicalOpportunityLedger: {
        opportunities: [],
        rendered_opportunities: [renderedOpportunity],
      },
    });
    expect(extraction.sourceMode).toBe('canonical_full');
    expect(extraction.items).toEqual([]);
    expect(extraction.canonicalCount).toBe(0);
    expect(extraction.renderedCount).toBe(1);
  });

  it('stamps degraded legacy fallback with rendered-opportunity provenance', () => {
    const projection = projectCanonicalRevisionOpportunities(
      { canonicalOpportunityLedger: { rendered_opportunities: [renderedOpportunity] } },
      'ued-hash',
      1_000,
    );
    expect(projection.sourceMode).toBe('legacy_rendered_degraded');
    expect(projection.opportunities).toHaveLength(1);
    expect(projection.opportunities[0]?.provenance).toBe(
      'unified_evaluation_document_v1.canonicalOpportunityLedger.rendered_opportunities',
    );
  });
});
