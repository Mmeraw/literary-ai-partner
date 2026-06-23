# Authority Chain

> This document defines the single governance hierarchy for RevisionGrade.
> Everything traces back to the Golden Records.
> Nothing outside this chain may claim authority over report content, structure, or rendering.

---

## Level 1 — Golden Records (Absolute Authority)

These documents define what the product IS. They are the only documents
that may define required sections, forbidden sections, ordering, terminology,
ownership boundaries, opportunity structure, and parity rules.

| Document | Path | Governs |
|----------|------|---------|
| Short-Form Evaluation Template | `docs/templates/evaluation/short-form-evaluation-template.md` | Short-form report content, sections, ordering, forbidden headings, opportunity structure, anti-duplication rules, gate conditions |
| Long-Form Multi-Layer Evaluation Template | `docs/templates/evaluation/long-form-multi-layer-evaluation-template.md` | DREAM-backed multi-layer report content, Story Ledger, Review Gate, cross-layer surfaces |
| Evaluation Rendering Contract | `docs/templates/evaluation/evaluation-rendering-contract.md` | Shared renderer restrictions for Web, PDF, DOCX, TXT, and print-friendly views |
| Surface Parity Matrix | `docs/templates/evaluation/surface-parity-matrix.md` | Field parity requirements across all four renderer surfaces |

### Rules

- Golden Records are the ONLY source of truth for report structure.
- If a Golden Record and any other document conflict, the Golden Record wins unconditionally.
- Changes to Golden Records require explicit review. They propagate downward through the chain.
- No benchmark, dream doc, corpus evaluation, or runtime module may override a Golden Record.

---

## Level 2 — Contract Registry (Executable Authority)

Machine-readable implementations of the Golden Records.
These translate human-readable template contracts into code that the runtime obeys.

| Component | Path | Derives From |
|-----------|------|--------------|
| Short-Form Contract | `lib/evaluation/contracts/shortFormContract.ts` | Short-Form Evaluation Template |
| Long-Form Multi-Layer Contract | `lib/evaluation/contracts/longFormMultiLayerContract.ts` | Long-Form Multi-Layer Evaluation Template |
| Evaluation Template Contracts (current) | `lib/evaluation/reportTemplateContract.ts` | Active templates |
| FIPOC Registry | `lib/evaluation/fipocRegistry.ts` | Authority Source Registry + Templates |

### Rules

- Contract Registry MUST trace every field to a specific Golden Record section.
- If Contract Registry and a Golden Record conflict, the Golden Record wins and the registry must be updated.
- Contract Registry defines: sections, section order, required fields, forbidden fields, surface ownership, allowed opportunity types, allowed headings.
- Runtime MUST obey the Contract Registry. It cannot add sections, headings, or opportunities not defined there.

---

## Level 3 — Runtime Representations

Runtime data structures that carry report content through the pipeline.
These are adapters and carriers — they do not define content.

| Component | Role | Obeys |
|-----------|------|-------|
| `UnifiedEvaluationDocument` (UED) | Canonical adapter between pipeline and renderers | Contract Registry |
| `normalizeEvaluationReportViewModel()` | Transforms UED into renderer-consumable shape | Contract Registry |
| `revision_opportunity_ledger_v1` | Sole canonical recommendation inventory | Short-Form / Multi-Layer Template |
| `REVISION_SURFACE_OWNERSHIP_GATE` | Pre-Phase-5 enforcement gate | Templates (all forbidden headings, traceability rules) |
| `author_exposure_certification_v1` | Final certification before author sees output | Templates + Rendering Contract |

### Rules

- Runtime MUST NOT define report content. It formats and validates.
- If runtime behavior conflicts with Contract Registry, the runtime has a bug.
- UED is a mandatory adapter, not an authority. It carries what the template requires, nothing more.
- `revision_opportunity_ledger_v1` is the sole recommendation inventory. No other module may independently generate author-facing repair recommendations.

---

## Level 4 — Renderers (Formatting Only)

Renderers consume the ViewModel and produce surface-specific output.
They MUST NOT contain business logic, generate content, or make decisions.

| Renderer | Output |
|----------|--------|
| Webpage | HTML for web display |
| PDF | Chromium-rendered PDF from HTML source |
| DOCX | Word document with structured paragraphs |
| TXT | Plain-text download |

### Rules

- Renderers format only. They do not:
  - Generate recommendations
  - Reorder sections
  - Rename headings
  - Add sections not in the Contract Registry
  - Remove sections present in the UED
  - Synthesize placeholders for omitted optional sections
- All four renderers MUST consume the same ViewModel.
- If renderer output diverges from UED content, that is a parity defect — not a renderer feature.
- Renderer-specific logic (e.g., page breaks in PDF, heading styles in DOCX) is cosmetic only.

---

## Level 5 — Validation Assets (Not Authority)

These documents prove the system works correctly.
They do NOT define what "correct" means — that comes from Golden Records.

| Asset Type | Examples | Role |
|------------|----------|------|
| Benchmark Reports | `docs/benchmarks/DREAM_LONGFORM_BENCHMARK_INDEX.md` | Calibration reference — proves system matches expectations |
| Dream Documents | `docs/governance/DREAM_OUTPUT_SPEC.md`, `DREAM_STATE_LONGFORM_CANON.md` | Completeness contracts for DREAM synthesis output |
| Corpus Golden Evaluations | `docs/evaluation/fixtures/...` | Regression fixtures — proves system still produces known-good output |
| Example Reports | `docs/gold-standards/...` | Quality bar references for recommendations, Revise rendering |
| Canon Documents | `docs/canon/...` | Governance anchors for criteria, calibration, ritual protection |

### Rules

- Validation assets prove correctness. They do not define it.
- If a benchmark expectation conflicts with a Golden Record, the benchmark must be updated.
- Dream documents define COMPLETENESS requirements for synthesis output. They must not become competing template authorities.
- "Dream Master", "Golden Master", "Dream Authority" language is prohibited outside Level 1 Golden Records. Use "Reference Benchmark" or "Validation Asset" instead.
- Corpus goldens are snapshots. When templates change, corpus goldens must be regenerated.

---

## Authority Conflict Resolution

When two documents disagree:

```
Golden Record > Contract Registry > Runtime > Renderer > Benchmark
```

Always resolve upward:
1. Check the Golden Record for the definitive answer.
2. Update the lower-level document to match.
3. Never modify a Golden Record to match a benchmark or runtime behavior.

---

## Prohibited Patterns

The following patterns indicate governance drift and must be corrected:

| Pattern | Why It's Wrong | Correction |
|---------|---------------|------------|
| Benchmark defining required sections | Benchmarks validate, not define | Move requirement to Golden Record |
| Runtime generating sections not in Contract Registry | Runtime carries, not creates | Remove unauthorized generation |
| Renderer adding headings | Renderers format, not author | Remove heading generation |
| Dream doc overriding template structure | Dream is completeness, not structure | Align Dream doc to template |
| "Source of truth" in a Level 5 doc | Only Level 1 is source of truth | Reword to "reference" or "calibration" |
| Multiple documents claiming authority over same field | Creates drift | Consolidate into single Golden Record |
| `criterion.recommendations` bypassing canonical ledger | Shadow inventory | Route through `revision_opportunity_ledger_v1` |

---

## Enforcement

| Mechanism | Enforces | Location |
|-----------|----------|----------|
| `REVISION_SURFACE_OWNERSHIP_GATE` | Forbidden headings, opportunity traceability, count parity, tier parity, duplication | `lib/evaluation/revisionSurfaceOwnershipGate.ts` |
| `author_exposure_certification_v1` | Final Phase 5 blocking gate | `lib/evaluation/processor.ts` |
| `report_render_manifest_v1` | Renderer parity across surfaces | `lib/evaluation/reportRenderParity.ts` |
| Authority Chain Lint (CI) | Flags unauthorized "source of truth" / "golden master" language | `scripts/authority-chain-lint.sh` |
| Template Completeness Gate | Required template fields present | `lib/evaluation/processor.ts` |

---

## Change Protocol

To modify the authority chain:

1. **Changing a Golden Record**: Requires PR review. All downstream (Contract Registry, Runtime, Benchmarks) must be updated in the same PR or immediate follow-up.
2. **Adding a new Level 1 document**: Requires explicit addition to this file and the `authority_source_registry.csv`.
3. **Promoting a Level 5 doc to authority**: Prohibited. If a benchmark reveals a gap, add the requirement to a Golden Record instead.
4. **Demoting a Level 1 doc**: Requires explicit removal from this file and migration of its requirements to the remaining Golden Records.
