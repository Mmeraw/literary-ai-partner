# Opportunity Discovery Policy — Implementation Map

**Canonical policy:** `docs/governance/OPPORTUNITY_DISCOVERY_POLICY.md`  
**Canonical code authority:** `lib/evaluation/policy/opportunityDiscoveryPolicy.ts`  
**Tracking issue:** #1307

This map exists so Devin, Perplexity, GitHub Copilot/Codex, and maintainers can migrate every embedded legacy rule without reinterpreting the canon.

## Required consumers

### Producers and prompts

- `lib/evaluation/pipeline/prompts/pass2-editorial.ts`
- `lib/evaluation/pipeline/runPass2.ts`
- `lib/evaluation/pipeline/prompts/pass3-synthesis.ts`
- `lib/evaluation/pipeline/runPass3Synthesis.ts`
- `lib/evaluation/pipeline/runPipeline.ts`
- WAVE and cross-WAVE opportunity producers

Required migration:

- inject `buildOpportunityDiscoveryPromptBlock(mode)`;
- remove fixed recommendation floors and fill targets;
- remove instructions equating low counts with suppressed evidence;
- prohibit deterministic or canned backfill;
- enforce Short Form source restrictions.

### Validators and gates

- `lib/evaluation/pipeline/templateCompletenessGate.ts`
- `lib/evaluation/pipeline/qualityGate.ts`
- `lib/evaluation/pipeline/recommendationIntegrityGate.ts`
- `lib/evaluation/pipeline/evidenceGroundingGate.ts`
- final sanity and certification gates

Required migration:

- replace embedded density tables with the canonical helper;
- validate governed zero-opportunity status through `hasGovernedOpportunityCoverage`;
- treat expected ranges as search guidance, not pass/fail floors;
- reject evidence/diagnosis non-entailment, symptom/cause duplication, and metadata-as-evidence;
- revalidate after any mutation or repair.

### Canonical assembly and ledgers

- `lib/evaluation/canonicalOpportunityLedger.ts`
- `lib/revision/opportunityLedger.ts`
- UED assembly
- render manifest assembly
- Revise ledger seeding

Required migration:

- preserve source provenance (`editorial`, `wave`, `cross_wave`, `story_engine`, `market_readiness`);
- enforce product ceilings of 50 and 100;
- deduplicate strategic levers before rendering;
- retain suppression reasons;
- never backfill after deduplication.

### Renderers

- web report
- PDF
- DOCX
- TXT
- Revise Workbench and queue

Required migration:

- render only canonical-ledger opportunities;
- display opportunity-source accounting where appropriate;
- never create, repair, or restore substantive advice;
- never show obsolete density warnings for valid high-score criteria.

### Diagnostics and documentation

- forensic reports
- pipeline technical defects
- SIPOC and DREAM output specifications
- developer and agent instructions

Required migration:

- replace “recommendation count” as a quality objective with “opportunity discovery accuracy”;
- retire contradictory count tables;
- rename or narrow `SCORE_LE8_EMPTY_RECOMMENDATIONS` so it cannot flag scores 9–10 and cannot flag a governed empty criterion;
- report expected-range shortfalls as evidence-search telemetry, not author-facing pipeline defects.

## Mandatory acceptance tests

The canonical test file begins at:

- `__tests__/lib/evaluation/policy/opportunityDiscoveryPolicy.test.ts`

Consumer migrations must add integration coverage proving:

1. 200-word and 1,500-word 9/10 criteria do not trigger synthetic recommendations.
2. 10/10 can render zero opportunities.
3. Weak criteria cannot be silently empty.
4. Governed insufficient-evidence status is accepted without filler.
5. Short Form cannot contain WAVE provenance.
6. Long Form can aggregate WAVE and cross-WAVE findings up to 100.
7. Deduplication lowers totals without triggering backfill.
8. Web/PDF/DOCX/TXT parity reflects the same final ledger.

## Migration rule

No consumer may copy numeric score guidance into a local constant. Import the canonical module. Any exception requires an explicit governance amendment to the policy document and tests.
