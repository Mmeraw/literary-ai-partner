# Artifact Authority Chain — SIPOC/FIPOC Governance Constitution

> **Status:** Active Phase 5A governance document
> **Top-level doctrine:** `docs/governance/AUTHORITY_CHAIN.md` (binding)
> **Evaluation counterpart:** `docs/SIPOC_EVALUATION_PROCESS.md`
> **Revise counterpart:** `docs/SIPOC_REVISE_PROCESS.md`
> **Agent Readiness counterpart:** `docs/SIPOC_AGENT_READINESS_PROCESS.md`
> **Governance:** `AI_GOVERNANCE.md` (binding)

---

## Purpose

This document is the **master governance SIPOC** for the RevisionGrade Artifact Authority Chain.
It declares the immutable artifact-level authority hierarchy from evaluation templates through contract registry,
certified UED, ViewModel, renderers, and validation assets.

`docs/governance/AUTHORITY_CHAIN.md` is the top-level doctrine. This document is the artifact-level
SIPOC/FIPOC execution map for that doctrine. Every other SIPOC (Evaluation, Revise, Agent Readiness,
Storygate) operates within the authority constraints declared here. When there is ambiguity about which
artifact governs, the top-level Authority Chain wins first; this document is the artifact-level tiebreaker.

---

## Authority Hierarchy (6 Levels)

```
Level 1 — Golden Records (Templates)
    ↓ governs
Level 2 — Contract Registry (Executable Authority)
    ↓ governs
Level 3 — Certified Runtime Artifacts (UED, ledgers, decisions, packages)
    ↓ governs
Level 4 — ViewModels / Product Boundaries
    ↓ governs
Level 5 — Renderers / Downloads / UI Surfaces
    ↓ validated by
Level 6 — Validation Assets (DREAM, Benchmarks, Fixtures, Regression Corpus)
```

### Authority Rules

| Rule | Description |
|---|---|
| Higher levels override lower | Template changes override contracts, contracts override runtime |
| Lower levels may NOT contradict higher | A renderer cannot add content not in the ViewModel |
| Each level inherits constraints from above | UED structure is constrained by the contract which is constrained by the template |
| Validation assets (Level 6) are NEVER sources of truth | DREAM, benchmarks, fixtures, and regression corpus validate — they do not define |

---

## Pipeline Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│  LEVEL 1: GOLDEN RECORDS (Templates)                                     │
│                                                                          │
│  short_form_template_v1          long_form_multilayer_template_v1        │
│                                                                          │
│  Purpose: Define canonical report shape, section order, criterion set,   │
│  scoring rubric, opportunity counting rules, confidence framework        │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │
                    TEMPLATE_CONTRACT_GATE
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LEVEL 2: CONTRACT REGISTRY                                              │
│                                                                          │
│  evaluation_contract_registry_v1                                         │
│    → shortFormContract.ts                                                │
│    → longFormContract.ts                                                 │
│    → longFormMultiLayerContract.ts                                       │
│                                                                          │
│  Purpose: Make template intent machine-executable. Declare section        │
│  ordering, criterion weights, score bounds, recommendation caps,         │
│  confidence thresholds                                                   │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │
                    UED_STRUCTURE_GATE
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LEVEL 3: RUNTIME REPRESENTATIONS                                        │
│                                                                          │
│  unified_evaluation_document_v1  (Certified UED)                         │
│                                                                          │
│  Purpose: Single canonical data structure carrying all evaluation         │
│  results. Phase 5-certified. Source of truth for all downstream          │
│  consumption (renderers, revise queue, agent readiness).                  │
│                                                                          │
│  Adjacent artifacts (same level):                                        │
│    evaluation_result_v2                                                   │
│    revision_opportunity_ledger_v1                                         │
│    revision_completion_record_v1                                          │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │
                    VIEWMODEL_BOUNDARY_GATE
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LEVEL 4: RENDERERS                                                      │
│                                                                          │
│  evaluation_report_view_model_v1  (ViewModel transformation)             │
│    → web_renderer    (HTML)                                              │
│    → pdf_renderer    (PDF via HTML)                                      │
│    → docx_renderer   (DOCX)                                             │
│    → txt_renderer    (plain text)                                        │
│                                                                          │
│  Purpose: Format certified data for human consumption. Renderers         │
│  perform formatting ONLY — no calculations, no sanitization,             │
│  no recommendation creation, no recounting.                              │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │
                    RENDER_PARITY_GATE
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LEVEL 5: VALIDATION ASSETS                                              │
│                                                                          │
│  DREAM corpus (benchmark evaluations)                                    │
│  Golden Fixtures (parity tests)                                          │
│  Regression benchmarks                                                   │
│                                                                          │
│  Purpose: Validate that the pipeline produces correct, consistent         │
│  output. Never define content — only validate it.                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Artifact Registry

| Artifact | Level | Canonical Path / Source | Versioned |
|---|---|---|---|
| `short_form_template_v1` | 1 | `docs/templates/evaluation/short-form-golden-record.md` | yes |
| `long_form_multilayer_template_v1` | 1 | `docs/templates/evaluation/long-form-multilayer-golden-record.md` | yes |
| `evaluation_contract_registry_v1` | 2 | `lib/evaluation/contracts/evaluationContractRegistry.ts` | yes |
| `unified_evaluation_document_v1` | 3 | Runtime artifact (Supabase `evaluation_documents` table) | yes |
| `evaluation_result_v2` | 3 | Runtime artifact (Supabase `evaluation_results` table) | yes |
| `revision_opportunity_ledger_v1` | 3 | Runtime artifact (assembled from criteria findings) | yes |
| `revision_completion_record_v1` | 3 | Runtime artifact (Supabase revision records) | yes |
| `author_decision_v1` | 3 | Runtime artifact (Supabase `revision_ledger_decisions`) | yes |
| `evaluation_report_view_model_v1` | 4 | `lib/evaluation/evaluationReportViewModel.ts` | yes |
| `web_renderer` | 4 | `app/evaluate/[jobId]/page.tsx`, `app/reports/[jobId]/page.tsx` | — |
| `pdf_renderer` | 4 | `app/api/evaluations/[jobId]/route.ts` (`renderCanonicalTemplateHtml` → PDF) | — |
| `docx_renderer` | 4 | `app/api/evaluations/[jobId]/route.ts` (`buildCanonicalTemplateDocx`) | — |
| `txt_renderer` | 4 | `app/api/evaluations/[jobId]/route.ts` (`buildCanonicalTemplateTxt`) | — |

---

## Gate Registry

| Gate | Between Levels | Purpose | Enforcement |
|---|---|---|---|
| `TEMPLATE_CONTRACT_GATE` | 1 → 2 | Contract must implement all template-declared criteria, sections, and scoring rules | CI + contract validation tests |
| `UED_STRUCTURE_GATE` | 2 → 3 | UED must conform to active contract structure (all fields populated, score bounds valid) | Runtime quality gates (S09, S10b) |
| `VIEWMODEL_BOUNDARY_GATE` | 3 → 4 | All sanitization, business logic, palette derivation applied exactly once in ViewModel — renderers format only | Boundary enforcement tests |
| `RENDER_PARITY_GATE` | 4 → 5 | All renderers produce identical logical content from the same ViewModel | Cross-format parity validation |

### Gate Input/Output Metrics

#### `TEMPLATE_CONTRACT_GATE`

| Metric | Input Threshold | Output Threshold |
|---|---|---|
| Template criterion coverage | Template declares ≥1 criterion | Contract implements 100% of template criteria |
| Section ordering match | Template defines section order | Contract section order matches template exactly |
| Score bound declaration | Template defines scoring scale | Contract enforces template-declared bounds |
| Recommendation cap alignment | Template declares max recommendations per criterion | Contract enforces declared caps |

#### `UED_STRUCTURE_GATE`

| Metric | Input Threshold | Output Threshold |
|---|---|---|
| Contract resolution | Active contract resolved for evaluation template path | UED structure matches active contract |
| Score population | Evaluation passes complete (P1+P2+P3) | All contract-declared scores present and within bounds |
| Criterion coverage | Contract declares N criteria | UED contains results for N criteria |
| Evidence completeness | Findings generated for criteria | ≥90% of findings have evidence anchors |
| Phase 5 certification | Quality gates passed | UED marked Phase 5-certified |

#### `VIEWMODEL_BOUNDARY_GATE`

| Metric | Input Threshold | Output Threshold |
|---|---|---|
| UED certification | Phase 5-certified UED present | ViewModel produced with all sections |
| Contract resolution | Active contract resolved | Section ordering matches contract |
| Sanitization completeness | Raw text present in UED | All author-facing text sanitized (mistakeProofText, correctScopeLanguage) |
| Palette derivation | Raw scores present | Score palettes derived (strong/watch/risk/muted) |
| Opportunity counting | Criteria findings present | Opportunity counts computed (not re-derived by renderers) |
| Single-application guarantee | N/A | No double-sanitization detected |

#### `RENDER_PARITY_GATE`

| Metric | Input Threshold | Output Threshold |
|---|---|---|
| ViewModel consumption | Same `evaluation_report_view_model_v1` | All formats consume identical ViewModel instance |
| Logical content parity | N/A | Scores, recommendation counts, executive summary, section order, confidence labels identical across Web/PDF/DOCX/TXT |
| Evidence preservation | ViewModel contains evidence anchors | `anchor_snippet` and evidence snippets byte-for-byte identical in all formats |
| Format-specific rendering | ViewModel provides structured data | Each renderer applies format-appropriate styling without altering content |

---

## Consumption Rules

### Who May Consume What

| Consumer | May Consume | May NOT Consume |
|---|---|---|
| Renderers (Web/PDF/DOCX/TXT) | `evaluation_report_view_model_v1` only | Raw UED, raw chunks, pass artifacts, seeds |
| Revise Queue | `unified_evaluation_document_v1` → `revision_opportunity_ledger_v1` | ViewModel (it's a render surface, not a data source) |
| Agent Readiness | Certified UED + certified ledger + certified decisions | Raw chunks, seeds, pass artifacts, ViewModel |
| DREAM / Benchmarks | All certified Level 3 artifacts (read-only) | May not write back or define authoritative content |
| Storygate Agents (future) | `agent_readiness_package_v1` only | Direct UED access, direct DB queries |

### Cross-Product Isolation

```
Evaluation ─── UED ──────────────────────────┐
                │                              │
                ├── ViewModel → Renderers      │ (SEPARATE PRODUCTS)
                │                              │
                └── Ledger → Revise Queue      │
                              │                │
                              └── Agent Ready ──┘
```

The ViewModel and the Revision Ledger are **separate product surfaces** from the same UED.
They MUST NOT cross-consume each other:
- Renderers MUST NOT read revision decisions
- Revise Queue MUST NOT read ViewModel
- Agent Readiness MUST NOT read ViewModel

---

## Failure Code Registry

| Code | Gate | Meaning |
|---|---|---|
| `TEMPLATE_CONTRACT_MISSING_CRITERION` | TEMPLATE_CONTRACT_GATE | Contract does not implement a template-declared criterion |
| `TEMPLATE_CONTRACT_SECTION_ORDER_MISMATCH` | TEMPLATE_CONTRACT_GATE | Contract section order differs from template |
| `UED_STRUCTURE_MISSING_SCORES` | UED_STRUCTURE_GATE | UED missing contract-required scores |
| `UED_STRUCTURE_BOUNDS_VIOLATION` | UED_STRUCTURE_GATE | Score outside contract-declared bounds |
| `UED_STRUCTURE_INCOMPLETE_CRITERIA` | UED_STRUCTURE_GATE | UED missing results for contract-declared criteria |
| `VIEWMODEL_BOUNDARY_VIOLATION` | VIEWMODEL_BOUNDARY_GATE | Renderer performed forbidden calculation/sanitization |
| `VIEWMODEL_CONTRACT_RESOLUTION_FAILED` | VIEWMODEL_BOUNDARY_GATE | Could not resolve active contract for ViewModel generation |
| `VIEWMODEL_SANITIZATION_FAILED` | VIEWMODEL_BOUNDARY_GATE | Text sanitization step failed |
| `RENDER_PARITY_FAILED` | RENDER_PARITY_GATE | Cross-format content differs from shared ViewModel |
| `AUTHORITY_LEVEL_VIOLATION` | Any | Lower level contradicted higher level authority |

---

## Runtime Doctrine

1. **Templates are truth.** When template and runtime disagree, the template is correct and runtime must be updated. Templates are never modified to match runtime bugs.

2. **Contracts are executable templates.** A contract that fails to implement a template requirement is a bug in the contract, not a limitation to work around.

3. **UED is the single certified state.** All downstream consumption (renderers, revise, agents) must trace back to a single certified UED. No fork, no duplicate, no stale copy.

4. **ViewModel transforms once.** All sanitization, palette derivation, confidence formatting, and opportunity counting happens exactly once in the ViewModel transformation. Duplication is a governance violation.

5. **Renderers format only.** No renderer may perform calculations, sanitization, recommendation creation, opportunity counting, or score derivation. They consume ViewModel and apply visual formatting.

6. **Parity is non-negotiable.** All renderers MUST produce identical logical content from the same ViewModel. Format-specific differences (HTML tags vs. DOCX paragraphs vs. plain text) are permitted; content differences are not.

7. **Validation assets validate, not define.** DREAM, fixtures, and benchmarks prove the pipeline works correctly. They are never treated as authoritative sources for what correct output looks like — only templates define that.

8. **Authority flows downward only.** A runtime bug does not change the template. A renderer limitation does not change the ViewModel spec. A fixture failure does not change the UED structure. Fix the lower level.

9. **Cross-product isolation.** Renderers, Revise Queue, and Agent Readiness are separate product surfaces. They share the certified UED as common input but must not cross-consume each other's artifacts.

10. **Traceability is always required.** Every artifact must be traceable to its source. UED traces to contract + evaluation passes. ViewModel traces to UED. Ledger traces to UED. Agent package traces to UED + ledger.

---

## Authority Source Registry

| Family | Title | Path |
|---|---|---|
| governance | AI Governance | `AI_GOVERNANCE.md` |
| governance | Artifact Authority Chain SIPOC | `docs/SIPOC_ARTIFACT_AUTHORITY_CHAIN.md` |
| template | Short-Form Golden Record | `docs/templates/evaluation/short-form-golden-record.md` |
| template | Long-Form Multi-Layer Golden Record | `docs/templates/evaluation/long-form-multilayer-golden-record.md` |
| contract | Evaluation Contract Registry | `lib/evaluation/contracts/evaluationContractRegistry.ts` |
| runtime | Evaluation Report ViewModel | `lib/evaluation/evaluationReportViewModel.ts` |
| runtime | Report Render Safety | `lib/evaluation/reportRenderSafety.ts` |
| runtime | Download Parity Gate | `lib/evaluation/downloadParityGate.ts` |
| governance | Evaluation SIPOC | `docs/SIPOC_EVALUATION_PROCESS.md` |
| governance | Revise SIPOC | `docs/SIPOC_REVISE_PROCESS.md` |
| governance | Agent Readiness SIPOC | `docs/SIPOC_AGENT_READINESS_PROCESS.md` |

---

## Certification Status

| Level | Status | Evidence |
|---|---|---|
| Level 1 (Templates) | Active | Short-form (#1172) and long-form multi-layer (#1173) templates committed |
| Level 2 (Contract Registry) | Active | `evaluationContractRegistry.ts` implements template criteria |
| Level 3 (Certified UED) | Active | Phase 5 certification in evaluation pipeline |
| Level 4 (ViewModel + Renderers) | Active | `evaluationReportViewModel.ts` + boundary enforcement tests |
| Level 5 (Validation Assets) | Emerging | DREAM corpus active; Golden Fixtures planned (Phase 5) |

---

## Metric Contract

| Metric | Description | Governing Gate | Threshold |
|---|---|---|---|
| `template_criterion_coverage` | % of template criteria implemented in contract | TEMPLATE_CONTRACT_GATE | 100% (enforced) |
| `contract_section_order_match` | Contract section order matches template | TEMPLATE_CONTRACT_GATE | exact match (enforced) |
| `ued_score_completeness` | % of contract-declared scores present in UED | UED_STRUCTURE_GATE | 100% (enforced) |
| `ued_evidence_coverage` | % of criteria findings with evidence anchors | UED_STRUCTURE_GATE | ≥90% (warning below) |
| `viewmodel_single_sanitization` | Author-facing text sanitized exactly once | VIEWMODEL_BOUNDARY_GATE | exactly 1 pass (enforced) |
| `viewmodel_palette_derivation` | All scores have derived palettes | VIEWMODEL_BOUNDARY_GATE | 100% (enforced) |
| `render_logical_parity` | All formats produce identical logical content | RENDER_PARITY_GATE | 100% parity (enforced) |
| `render_evidence_preservation` | Evidence snippets byte-for-byte identical across formats | RENDER_PARITY_GATE | 100% (enforced) |
| `authority_level_compliance` | No lower-level artifact contradicts higher-level | All gates | 0 violations (enforced) |
| `traceability_chain_completeness` | Every artifact traceable to source | All gates | 100% (enforced) |

**Metric enforcement levels:**
- **Enforced** — violation blocks the pipeline or is a CI-failing defect
- **Warning** — violation emits diagnostic telemetry; pipeline continues
- **Passive** — observability only; must not alter control flow
