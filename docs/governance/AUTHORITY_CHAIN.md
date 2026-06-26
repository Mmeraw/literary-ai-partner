# RevisionGrade Authority Chain

> **Status:** Active Phase 5A governance doctrine  
> **Scope:** Evaluation, renderer/download, Revise, Agent Readiness, DREAM, benchmark, fixture, and corpus authority  
> **Companion SIPOC:** `docs/SIPOC_ARTIFACT_AUTHORITY_CHAIN.md`  
> **Executable mirrors:** `lib/evaluation/fipocRegistry.ts`, `lib/revision/reviseRegistry.ts`, `lib/agent-readiness/agentReadinessRegistry.ts`, `docs/registries/**/*.csv`

---

## Purpose

This document defines the permanent authority order for RevisionGrade.

It exists to prevent architectural drift between templates, executable contracts, certified runtime artifacts, ViewModels, renderer surfaces, Revise, Agent Readiness, DREAM benchmarks, and regression fixtures.

The binding rule is:

> **Templates define intent. Contracts execute intent. Runtime implements contracts. ViewModels prepare author-facing presentation. Renderers format only. DREAM, benchmarks, fixtures, and corpus assets validate only.**

No document, runtime module, benchmark, fixture, DREAM evaluation, renderer, or downstream agent may claim authority outside this chain.

---

## Binding Authority Order

```text
Level 1 — Templates / Golden Records
    ↓ governs
Level 2 — Executable Contracts / Registries
    ↓ governs
Level 3 — Certified Runtime Artifacts
    ↓ governs
Level 4 — ViewModels / Product Boundaries
    ↓ governs
Level 5 — Renderers / Downloads / UI Surfaces
    ↓ validated by
Level 6 — DREAM, Benchmarks, Golden Fixtures, Regression Corpus
```

Authority flows downward only. Lower levels may report defects upward, but lower levels never redefine higher levels.

---

## Level 1 — Templates / Golden Records

Templates are the semantic authority for product shape.

They define:

- required sections
- forbidden sections
- section order
- report modes
- criterion families
- scoring semantics
- recommendation expectations
- opportunity structure
- confidence language
- author-facing product boundaries
- parity expectations across Web/PDF/DOCX/TXT

Current examples:

| Document | Path | Governs |
|---|---|---|
| Short-Form Evaluation Template | `docs/templates/evaluation/short-form-evaluation-template.md` | Short-form report structure, section order, forbidden headings, opportunity structure, anti-duplication rules |
| Long-Form Multi-Layer Evaluation Template | `docs/templates/evaluation/long-form-multi-layer-evaluation-template.md` | Long-form multi-layer report structure, DREAM-backed layer semantics, Story Ledger/Review Gate visibility |
| Evaluation Rendering Contract | `docs/templates/evaluation/evaluation-rendering-contract.md` | Cross-surface renderer restrictions and output parity requirements |
| Surface Parity Matrix | `docs/templates/evaluation/surface-parity-matrix.md` | Field-level parity across Web/PDF/DOCX/TXT |

### Level 1 rules

- Templates are not changed to match runtime bugs.
- Runtime must be brought back into conformance with templates.
- Benchmarks, DREAM, fixtures, and historical reports cannot override templates.
- A new author-facing product surface requires either an existing template contract or a new Level 1 template.

---

## Level 2 — Executable Contracts / Registries

Contracts make template intent machine-executable. They encode required fields, enum values, artifact ownership, acceptance thresholds, failure codes, stage boundaries, and consumer rules.

Current examples:

| Component | Path | Derives from |
|---|---|---|
| Short-Form Contract | `lib/evaluation/contracts/shortFormContract.ts` | Short-form template |
| Long-Form Contract | `lib/evaluation/contracts/longFormContract.ts` | Long-form template |
| Long-Form Multi-Layer Contract | `lib/evaluation/contracts/longFormMultiLayerContract.ts` | Long-form multi-layer template |
| Evaluation Contract Registry | `lib/evaluation/contracts/evaluationContractRegistry.ts` | Active evaluation templates |
| FIPOC Registry | `lib/evaluation/fipocRegistry.ts` | SIPOC/FIPOC authority and artifact registry |
| Revise Registry | `lib/revision/reviseRegistry.ts` | Revise SIPOC/FIPOC |
| Agent Readiness Registry | `lib/agent-readiness/agentReadinessRegistry.ts` | Agent Readiness SIPOC/FIPOC |
| CSV Registry Mirrors | `docs/registries/**/*.csv` | Spreadsheet-reviewable mirror of executable registries |

### Level 2 rules

- Contracts must trace every field to a Level 1 template or documented runtime artifact owner.
- If a contract and template conflict, the contract is wrong.
- CSV mirrors must match executable registries.
- A registry entry that describes aspirational behavior must be marked as `planned`, `gap`, `emerging`, or `missing_critical`.
- Paper architecture is forbidden: undocumented runtime behavior and unwired registry behavior are both defects.

---

## Level 3 — Certified Runtime Artifacts

Certified runtime artifacts are the only runtime state downstream systems may consume.

Current examples:

| Artifact | Owner | Consumers |
|---|---|---|
| `unified_evaluation_document_v1` | Evaluation pipeline / certification gates | ViewModel normalizer, Revise ledger assembly, Agent Readiness certified context |
| `evaluation_result_v2` | Evaluation normalization/persistence | UED assembly, administrative views, compatibility reads where explicitly documented |
| `revision_opportunity_ledger_v1` | Evaluation-to-Revise ledger assembly | Revise Queue, Revise Workbench, Agent Readiness if revise completed |
| `workbench_queue_v1` | Revise admission/prioritization | Revise Workbench only |
| `author_decision_v1` | Author decision capture | Revise ledger sync, Agent Readiness if revise completed |
| `revision_completion_record_v1` | Revise completion certification | Agent Readiness, downstream Storygate packages |
| `agent_readiness_package_v1` | Agent Readiness package generator | Storygate and downstream agent surfaces |

### Level 3 rules

- Runtime artifacts carry certified state; they do not redefine templates.
- Raw chunks, seeds, pass artifacts, temporary diagnostics, and logs are not downstream authority.
- UED is the certified evaluation data source, but renderers do not consume it directly.
- UED may feed multiple product surfaces, but those surfaces must not cross-consume each other.

---

## Level 4 — ViewModels / Product Boundaries

ViewModels are product-boundary transformations. They prepare certified data for a specific product surface.

For evaluation reports, the binding path is:

```text
Certified UED
    ↓
normalizeEvaluationReportViewModel()
    ↓
evaluation_report_view_model_v1
```

The evaluation report ViewModel owns:

- author-facing sanitization
- scope-language correction
- confidence formatting
- palette derivation
- report section shaping
- criterion detail shaping
- opportunity counts
- render-ready field selection
- product-specific display names and labels

### Level 4 rules

- ViewModel transformation happens once.
- Renderers must not re-sanitize, re-score, re-count, re-order, re-synthesize, or repair report content.
- Revise Queue must not consume the ViewModel; it consumes `revision_opportunity_ledger_v1`.
- Agent Readiness must not consume the ViewModel; it consumes certified UED + ledger + decisions.
- ViewModels are presentation boundaries, not general data APIs.

---

## Level 5 — Renderers / Downloads / UI Surfaces

Renderers are formatting surfaces only.

Current evaluation renderer path:

```text
evaluation_report_view_model_v1
    ├── Web renderer
    ├── HTML/PDF renderer
    ├── DOCX renderer
    └── TXT renderer
```

Renderer output may differ in layout, typography, pagination, accessibility affordances, file format, and print constraints. Logical report content must remain identical.

### Level 5 rules

Renderers may:

- choose layout
- choose typography
- choose page breaks
- choose file-format-specific structures
- escape HTML/XML where required by the format

Renderers must not:

- generate recommendations
- generate fallback analysis
- rename headings
- add unauthorized sections
- remove template-required sections
- recalculate scores
- recount opportunities
- sanitize already-VM-owned text
- read raw UED fields for author-facing content
- read Revise decisions or Agent package state

A renderer that cannot display a ViewModel field has a renderer defect. It must not reinterpret the field.

---

## Level 6 — DREAM, Benchmarks, Golden Fixtures, Regression Corpus

Validation assets prove the system works correctly. They do not define correctness.

Correct roles:

- detect regressions
- verify expected report shape
- prove renderer parity
- calibrate benchmark quality
- track drift across time
- validate long-form multi-layer output after contracts stabilize

Incorrect roles:

- defining template requirements
- overriding executable contracts
- justifying renderer-specific interpretation
- becoming a second source of truth for report structure
- changing runtime expectations without template/contract updates

### DREAM doctrine

DREAM is a validation asset and reference evaluation corpus. It is not a runtime authority.

DREAM enrichment belongs **after**:

1. authority chain alignment
2. executable contract registry alignment
3. VM renderer parity
4. golden fixtures
5. Revise/Agent authority unification

DREAM may then serve as:

- benchmark asset
- reference evaluation
- regression corpus
- degradation detector

DREAM must not serve as:

- source of report truth
- template substitute
- renderer behavior authority
- hidden production prompt authority

---

## Cross-Surface Consumption Matrix

| Surface | May consume | Must not consume |
|---|---|---|
| Evaluation Web renderer | `evaluation_report_view_model_v1` | Raw UED, raw chunks, pass artifacts, seeds, Revise decisions |
| Evaluation PDF/HTML renderer | `evaluation_report_view_model_v1` | Raw `result.*`, raw UED author-facing fields, legacy render adapters as authority |
| Evaluation DOCX renderer | `evaluation_report_view_model_v1` | Raw UED author-facing fields, renderer-side sanitizers |
| Evaluation TXT renderer | `evaluation_report_view_model_v1` | Raw UED author-facing fields, renderer-side recounters |
| Revise Queue | `revision_opportunity_ledger_v1` derived from certified UED | ViewModel, renderer output, DREAM text, raw pass artifacts |
| Revise Workbench | `workbench_queue_v1`, `author_decision_v1`, certified ledger evidence | Renderer output, ViewModel, DREAM text, raw chunks |
| Agent Readiness | Certified UED + certified ledger + certified decisions | ViewModel, raw chunks, pass artifacts, temporary diagnostics |
| DREAM / Benchmarks | Certified artifacts read-only | Write-back authority, template override authority |
| Storygate agents | `agent_readiness_package_v1` | Direct DB queries, direct UED reads, ViewModel |

---

## Artifact Ownership Doctrine

Every canonical artifact must have one owner.

| Artifact | Single owner | Ownership violation example |
|---|---|---|
| Template | Product governance | Runtime changes template meaning silently |
| Contract | Contract registry | Renderer invents a field not declared by contract |
| UED | Evaluation pipeline certification | Download route mutates UED-shaped copy as authority |
| ViewModel | ViewModel normalizer | Renderer re-sanitizes or reorders VM-owned fields |
| Revision Ledger | Ledger assembly | Renderer or DREAM creates shadow recommendations |
| Workbench Queue | Revise admission/prioritization | UI fabricates queue state |
| Author Decision | Author decision capture | UI simulates persisted decision state |
| Agent Package | Agent Readiness package generator | Agent reads raw UED or DB directly |
| Benchmark | Validation corpus owner | Benchmark asserts template authority |

---

## Authority Conflict Resolution

When two layers disagree:

```text
Template > Contract > Certified Runtime Artifact > ViewModel > Renderer > Validation Asset
```

Resolution procedure:

1. Identify the highest-level source involved.
2. Treat the highest-level source as correct unless it is explicitly deprecated.
3. Update lower-level contracts/runtime/docs/tests to match.
4. Do not update a template to match a runtime accident.
5. Do not update runtime to match a benchmark unless the benchmark reflects a template/contract requirement.
6. If behavior is aspirational, mark it as planned/gap instead of pretending it is active.

---

## Prohibited Drift Patterns

| Pattern | Why it is wrong | Required correction |
|---|---|---|
| Benchmark defining required sections | Benchmarks validate, not define | Move requirement to template/contract |
| DREAM doc overriding template structure | DREAM is validation, not product authority | Align DREAM to template after contracts stabilize |
| Renderer adding headings | Renderer formats, not authors | Move heading to ViewModel/contract or remove |
| Renderer reading raw UED for author-facing fields | Bypasses ViewModel boundary | Route through `evaluation_report_view_model_v1` |
| Renderer sanitizing VM-owned text | Double interpretation | Remove renderer sanitizer |
| Revise reading ViewModel | Cross-product contamination | Read `revision_opportunity_ledger_v1` |
| Agent package reading ViewModel | ViewModel is renderer surface | Read certified UED + ledger + decisions |
| Multiple documents claiming source of truth | Creates drift | Consolidate under this authority chain |
| Paper-only stage/gate with no runtime or gap marker | Misleads roadmap | Implement, mark as gap, or remove |
| Legacy `result.*` renderer helper path | Shadow renderer brain | Delete dead code or route through VM |

---

## Enforcement

| Mechanism | Enforces | Location |
|---|---|---|
| Template completeness gates | Template-required fields present | Evaluation pipeline tests/gates |
| Contract registry tests | Template-to-contract alignment | `lib/evaluation/contracts/**`, registry tests |
| ViewModel boundary tests | VM-owned fields rendered from VM only | `__tests__/lib/evaluation/*ViewModel*`, boundary tests |
| Renderer parity tests | Web/PDF/DOCX/TXT logical parity | Download/surface parity tests |
| FIPOC registry tests | Stage/artifact/consumer matrix integrity | `__tests__/lib/evaluation/fipocRegistry.test.ts` |
| Revise registry tests | Revise stage/artifact/state integrity | `__tests__/lib/revision/reviseRegistry.test.ts` |
| Agent readiness registry tests | Agent package traceability/state integrity | `__tests__/lib/agent-readiness/agentReadinessRegistry.test.ts` |
| Authority/SIPOC review | No stale design docs | Phase 5A audit |

---

## Change Protocol

Every material runtime change must update the authority layer in the same development cycle:

1. Confirm template authority.
2. Update executable contract/registry if semantics changed.
3. Update runtime implementation.
4. Update ViewModel boundary if presentation semantics changed.
5. Update renderer parity tests if output changed.
6. Update SIPOC/FIPOC and CSV mirrors.
7. Update benchmarks/fixtures only after authority and runtime are stable.

Docs-only SIPOC/FIPOC changes are allowed when correcting drift, but they must not introduce aspirational behavior without marking it as planned, emerging, gap, or missing_critical.

---

## Phase 5A SIPOC/FIPOC Audit Checklist

A SIPOC/FIPOC authority audit is complete only when all of the following are true:

- Every artifact has exactly one owner.
- Every artifact declares allowed suppliers and consumers.
- Evaluation renderers point to `evaluation_report_view_model_v1`, not raw UED.
- Download renderers point to `evaluation_report_view_model_v1`, not raw `result.*` helpers.
- Revise consumers point to `revision_opportunity_ledger_v1`, not ViewModel.
- Agent consumers point to certified UED + ledger + decisions, not ViewModel.
- DREAM and benchmarks are validation assets only.
- TypeScript registries and CSV mirrors agree.
- Dead or unwired design elements are implemented, marked as gaps, or removed.
- Full CI and registry tests pass.

---

## Relationship to SIPOC/FIPOC Documents

This document is the top-level doctrine. Process-specific authorities remain:

- `docs/SIPOC_ARTIFACT_AUTHORITY_CHAIN.md`
- `docs/SIPOC_EVALUATION_PROCESS.md`
- `docs/SIPOC_REVISE_PROCESS.md`
- `docs/SIPOC_AGENT_READINESS_PROCESS.md`
- `docs/SIPOC_STORYGATE_PROCESS.md`
- `lib/evaluation/fipocRegistry.ts`
- `lib/revision/reviseRegistry.ts`
- `lib/agent-readiness/agentReadinessRegistry.ts`

If a lower-level SIPOC/FIPOC disagrees with this authority chain, the lower-level document must be corrected or explicitly marked as a known runtime gap.
