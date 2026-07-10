from pathlib import Path

path = Path('lib/revision/opportunityLedger.ts')
text = path.read_text()

replacements = [
    (
        "function canonicalUedOpportunityToRevisionOpportunity(item: Record<string, unknown>, sourceUedHash: string): RevisionOpportunity | null {",
        "function canonicalUedOpportunityToRevisionOpportunity(\n  item: Record<string, unknown>,\n  sourceUedHash: string,\n  provenance: string,\n): RevisionOpportunity | null {",
    ),
    (
        "    provenance: 'unified_evaluation_document_v1.canonicalOpportunityLedger.opportunities',",
        "    provenance,",
    ),
    (
        """  const canonical = Array.isArray(ledger?.opportunities)
    ? ledger.opportunities.filter((item): item is Record<string, unknown> => isRecord(item))
    : [];
  const rendered = Array.isArray(ledger?.rendered_opportunities)
""",
        """  const canonicalPresent = Array.isArray(ledger?.opportunities);
  const canonical = canonicalPresent
    ? ledger.opportunities.filter((item): item is Record<string, unknown> => isRecord(item))
    : [];
  const rendered = Array.isArray(ledger?.rendered_opportunities)
""",
    ),
    ("  if (canonical.length > 0) {", "  if (canonicalPresent) {"),
    (
        """  const extraction = extractCanonicalRevisionOpportunities(unifiedDocument);
  const opportunities = extraction.items
    .map((item) => canonicalUedOpportunityToRevisionOpportunity(item, sourceUedHash))
""",
        """  const extraction = extractCanonicalRevisionOpportunities(unifiedDocument);
  const provenance = extraction.sourceMode === 'canonical_full'
    ? 'unified_evaluation_document_v1.canonicalOpportunityLedger.opportunities'
    : 'unified_evaluation_document_v1.canonicalOpportunityLedger.rendered_opportunities';
  const opportunities = extraction.items
    .map((item) => canonicalUedOpportunityToRevisionOpportunity(item, sourceUedHash, provenance))
""",
    ),
    (
        """  const extraction = extractCanonicalRevisionOpportunities(unifiedDocument);
  const mapped = extraction.items
    .map((item) => canonicalUedOpportunityToRevisionOpportunity(item, sourceUedHash))
""",
        """  const extraction = extractCanonicalRevisionOpportunities(unifiedDocument);
  const provenance = extraction.sourceMode === 'canonical_full'
    ? 'unified_evaluation_document_v1.canonicalOpportunityLedger.opportunities'
    : 'unified_evaluation_document_v1.canonicalOpportunityLedger.rendered_opportunities';
  const mapped = extraction.items
    .map((item) => canonicalUedOpportunityToRevisionOpportunity(item, sourceUedHash, provenance))
""",
    ),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'anchor not found: {old[:80]}')
    text = text.replace(old, new, 1)
path.write_text(text)

Path('__tests__/lib/revision/reviseCanonicalAuthorityEdges.test.ts').write_text("""import {
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
""")

verify = Path('scripts/verify-phase-a5-day2.sh')
v = verify.read_text()
old = """if npx tsc --noEmit --skipLibCheck 2>&1 | grep -v "__tests__" | grep -q "error TS"; then
  echo -e "${RED}❌ TypeScript errors found${NC}"
      npx tsc --noEmit --skipLibCheck 2>&1 | grep -v "__tests__" | grep "error TS" | head -10
  exit 1
else
  echo -e "${GREEN}✅ TypeScript compiles cleanly${NC}"
fi
"""
new = """set +e
npx tsc --noEmit --skipLibCheck --pretty false > /tmp/a5-tsc.log 2>&1
TSC_STATUS=$?
set -e
NON_TEST_ERRORS=$(grep -E '^[^[:space:]].*error TS[0-9]+:' /tmp/a5-tsc.log | grep -v '__tests__' || true)
if [ -n "$NON_TEST_ERRORS" ]; then
  echo -e "${RED}❌ TypeScript errors found outside tests${NC}"
  echo "$NON_TEST_ERRORS" | head -10
  exit 1
elif [ "$TSC_STATUS" -ne 0 ]; then
  echo -e "${YELLOW}⚠️  TypeScript reported test-only diagnostics; production source check is clean${NC}"
else
  echo -e "${GREEN}✅ TypeScript compiles cleanly${NC}"
fi
"""
if old not in v:
    raise SystemExit('A5 TypeScript check anchor not found')
verify.write_text(v.replace(old, new, 1))
