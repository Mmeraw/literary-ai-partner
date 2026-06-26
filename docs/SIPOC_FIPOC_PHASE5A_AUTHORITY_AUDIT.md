# Phase 5A SIPOC/FIPOC Authority Audit Addendum

> **Status:** Active Phase 5A design-authority addendum  
> **Top-level doctrine:** `docs/governance/AUTHORITY_CHAIN.md`  
> **Companion constitution:** `docs/SIPOC_ARTIFACT_AUTHORITY_CHAIN.md`  
> **Scope:** Evaluation, renderers/downloads, Revise, Agent Readiness, DREAM, benchmarks, golden fixtures, and registry mirrors

---

## Purpose

This addendum records the Phase 5A authority audit rules for all SIPOC/FIPOC documents.

It is intentionally design-only. It does not introduce runtime behavior. It clarifies how existing runtime, registries, and process documents must be interpreted after the ViewModel renderer migration and dead legacy renderer cleanup.

The governing principle is:

> **SIPOC/FIPOC documents are architecture, not commentary. If a SIPOC/FIPOC describes a stage, artifact, supplier, consumer, or gate, it must either match runtime, be marked as planned/gap, or be removed.**

---

## Phase 5A Audit Scope

The audit covers:

| Family | Primary files | Required outcome |
|---|---|---|
| Authority Chain | `docs/governance/AUTHORITY_CHAIN.md`, `docs/SIPOC_ARTIFACT_AUTHORITY_CHAIN.md` | One clear hierarchy from templates to validation assets |
| Evaluation | `docs/SIPOC_EVALUATION_PROCESS.md`, `lib/evaluation/fipocRegistry.ts` | Certified UED → ViewModel → renderers; no raw-renderer authority |
| Renderer/Download | `app/reports/[jobId]/page.tsx`, `app/api/reports/[jobId]/download/route.ts`, renderer tests | Web/PDF/DOCX/TXT consume ViewModel-owned fields |
| Revise | `docs/SIPOC_REVISE_PROCESS.md`, `lib/revision/reviseRegistry.ts` | Ledger-first queue/workbench authority |
| Agent Readiness | `docs/SIPOC_AGENT_READINESS_PROCESS.md`, `lib/agent-readiness/agentReadinessRegistry.ts` | Certified package authority; no ViewModel consumption |
| Registry Mirrors | `docs/registries/**/*.csv` | CSV mirrors match executable registries |
| DREAM/Benchmarks | `docs/benchmarks/**`, DREAM governance docs | Validation assets only, not product authority |

---

## Binding Authority Path

The current authoritative report path is:

```text
Template / Golden Record
    ↓
Executable Contract / Registry
    ↓
Certified UnifiedEvaluationDocument
    ↓
EvaluationReportViewModel
    ↓
Renderer / Download Surface
    ↓
Validation by DREAM, benchmark, fixture, or regression corpus
```

### Report renderer invariant

All report renderers must consume `evaluation_report_view_model_v1` for author-facing report content.

This includes:

- web report
- HTML/PDF download
- DOCX download
- TXT download

Renderers may format. Renderers may not reinterpret.

---

## Artifact Ownership Matrix

| Artifact | Single owner | Permitted suppliers | Permitted consumers | Forbidden consumers |
|---|---|---|---|---|
| `short_form_template_v1` | Template governance | Product governance | Contract registry | Runtime ad hoc code |
| `long_form_template_v1` | Template governance | Product governance | Contract registry | Runtime ad hoc code |
| `long_form_multilayer_template_v1` | Template governance | Product governance | Contract registry, DREAM validation | Runtime ad hoc code |
| `evaluation_contract_registry_v1` | Evaluation contracts | Templates | UED structure gates, ViewModel normalizer, registry tests | Renderers as fallback source |
| `unified_evaluation_document_v1` | Evaluation pipeline certification | Evaluation passes + normalization + gates | ViewModel normalizer, Revise ledger assembly, Agent certified context | Renderers directly for author-facing fields |
| `evaluation_result_v2` | Evaluation persistence/normalization | Evaluation pipeline | UED assembly, compatibility reads, admin views | Renderers as primary report brain |
| `evaluation_report_view_model_v1` | ViewModel normalizer | Certified UED | Web/PDF/DOCX/TXT renderers | Revise Queue, Agent Readiness |
| `revision_opportunity_ledger_v1` | Ledger assembly | Certified UED + criteria findings | Revise Queue, Workbench, Agent Readiness if revise completed | Renderers as report source |
| `workbench_queue_v1` | Revise admission/prioritization | Revision ledger | Revise Workbench | Evaluation renderers, Agent generators |
| `author_decision_v1` | Author decision capture | Explicit author action | Revise ledger sync, completion certification | Renderers |
| `revision_completion_record_v1` | Revise completion certification | Ledger sync | Agent Readiness, Storygate packages | Renderers |
| `agent_readiness_package_v1` | Agent Readiness generator | Certified UED + ledger + decisions | Downstream Storygate/agent products | Evaluation renderers |
| DREAM benchmark asset | Benchmark/corpus governance | Certified artifacts, manual benchmark creation | Regression validation only | Runtime authority chain |

---

## Evaluation SIPOC/FIPOC Corrections Required

The Evaluation SIPOC/FIPOC must state the current renderer authority path as:

```text
Certified UED
    ↓
normalizeEvaluationReportViewModel()
    ↓
evaluation_report_view_model_v1
    ↓
Web/PDF/DOCX/TXT renderers
```

It must not describe renderers as consuming UED directly for author-facing fields.

Allowed UED use after certification:

- source-truth gates
- ViewModel normalization
- Revise ledger assembly
- Agent certified-context assembly
- admin/forensic views where explicitly labeled as diagnostic

Forbidden UED use:

- renderer-side sanitization
- renderer-side score derivation
- renderer-side recommendation synthesis
- renderer-side opportunity counting
- renderer-side section fallback generation

---

## Renderer/Download SIPOC/FIPOC Corrections Required

Renderer and download documentation must record that the legacy raw-result renderers have been removed as dead code and are not authority.

Current invariant:

```text
renderTxtFromViewModel(vm)
renderHtmlFromViewModel(vm)
renderDocxFromViewModel(vm)
```

The PDF path is HTML-backed, but logical content authority remains the ViewModel.

Renderer-specific CSS, pagination, page breaks, wrapping, escaping, and document structure are permitted format work. They do not confer content authority.

---

## Revise SIPOC/FIPOC Corrections Required

Revise is ledger-first.

The authoritative Revise input path is:

```text
Certified UED
    ↓
revision_opportunity_ledger_v1
    ↓
REVISE_ADMISSION_GATE
    ↓
REVISE_LEDGER_TRACEABILITY_GATE
    ↓
workbench_queue_v1
    ↓
author_decision_v1
    ↓
revision_completion_record_v1
```

Revise must not consume:

- `evaluation_report_view_model_v1`
- rendered report text
- DREAM prose as source authority
- pass artifacts as direct queue input

If a Revise registry element exists only on paper, it must be explicitly marked as planned/gap or wired in runtime before being called active.

---

## Agent Readiness SIPOC/FIPOC Corrections Required

Agent Readiness consumes certified package inputs only.

The authoritative Agent Readiness input path is:

```text
Certified UED
    +
revision_opportunity_ledger_v1
    +
revision_completion_record_v1 / author_decision_v1 if revise completed
    ↓
AGENT_PACKAGE_TRACEABILITY_GATE
    ↓
agent_readiness_package_v1
```

Agent Readiness must not consume:

- ViewModel
- renderer output
- raw chunks
- seed outputs
- pass artifacts
- temporary diagnostics as content

Known gaps in Agent Readiness must remain explicit until fixed. They must not be described as certified runtime behavior.

---

## DREAM / Benchmark / Fixture Doctrine

DREAM and benchmarks are Level 6 validation assets.

They may validate:

- section presence
- parity
- regression behavior
- benchmark quality
- long-form multi-layer consistency
- degradation over time

They may not define:

- template structure
- renderer behavior
- runtime authority
- source-of-truth artifact ownership
- product promises

DREAM enrichment is intentionally sequenced after:

1. Authority Chain alignment
2. Contract registry alignment
3. ViewModel renderer parity
4. Golden fixtures
5. Revise/Agent authority unification

---

## Registry Synchronization Rules

The following must agree:

```text
TypeScript registry
    ↓
CSV mirror
    ↓
SIPOC/FIPOC document
    ↓
Runtime implementation
    ↓
Tests / gates
```

Required registry checks:

- every process has a stage ID
- every stage has supplier/input/process/output/customer
- every artifact has one owner
- every artifact has allowed consumers
- every gate has a failure code or documented passive status
- every planned behavior is marked planned/gap/emerging
- every active behavior has runtime evidence

---

## Phase 5A Acceptance Criteria

Phase 5A is complete only when:

- `docs/governance/AUTHORITY_CHAIN.md` is present and binding.
- Evaluation SIPOC/FIPOC documents state the VM renderer boundary correctly.
- Revise SIPOC/FIPOC documents state ledger-first authority correctly.
- Agent Readiness SIPOC/FIPOC documents state certified-package authority correctly.
- DREAM and benchmark docs are treated as validation assets only.
- `lib/evaluation/fipocRegistry.ts` agrees with the CSV mirrors.
- `lib/revision/reviseRegistry.ts` agrees with Revise CSV mirrors.
- `lib/agent-readiness/agentReadinessRegistry.ts` agrees with Agent Readiness CSV mirrors.
- No stale `UED → renderer` authority remains for author-facing report content.
- No stale `result.* → renderer` authority remains for downloads.
- No dead architecture is described as active.

---

## Next Phase Boundary

After this audit, Phase 5B may create or harden executable contract files:

- `shortFormContract.ts`
- `longFormContract.ts`
- `longFormMultiLayerContract.ts`

DREAM enrichment comes later and must remain a validation/corpus project, not an authority project.
