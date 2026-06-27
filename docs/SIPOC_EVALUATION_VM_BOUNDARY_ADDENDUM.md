# Evaluation SIPOC Addendum — ViewModel Renderer Boundary

> **Status:** Active Phase 5A SIPOC addendum  
> **Parent SIPOC:** `docs/SIPOC_EVALUATION_PROCESS.md`  
> **Top-level doctrine:** `docs/governance/AUTHORITY_CHAIN.md`  
> **Artifact authority:** `docs/SIPOC_ARTIFACT_AUTHORITY_CHAIN.md`

---

## Normative Relationship

This document is a **normative extension** of `docs/SIPOC_EVALUATION_PROCESS.md`.

Together they form one authoritative Evaluation SIPOC.

Neither document should be interpreted independently.

## Purpose

This addendum corrects and clarifies the Evaluation SIPOC renderer boundary after the Phase 4b ViewModel renderer work.

Where older text says renderers consume the active evaluation template through `UnifiedEvaluationDocument`, the current authority path is now:

```text
Certified UED
    ↓
normalizeEvaluationReportViewModel()
    ↓
evaluation_report_view_model_v1
    ↓
Web / PDF / DOCX / TXT renderers
```

This addendum is binding for Evaluation SIPOC interpretation until the parent SIPOC is fully rewritten in a later consolidated edit.

---

## Binding Correction

The renderer-facing doctrine is:

> **Renderers consume `evaluation_report_view_model_v1`, not raw UED and not raw `evaluation_result_v2`.**

`UnifiedEvaluationDocument` remains the certified runtime artifact for evaluation state. It feeds the ViewModel normalizer. It is not the direct author-facing renderer input.

---

## Correct Consumer Rules

| Consumer | May consume | Must not consume |
|---|---|---|
| Web report renderer | `evaluation_report_view_model_v1` | Raw UED author-facing fields, raw chunks, pass artifacts, seeds |
| PDF/HTML renderer | `evaluation_report_view_model_v1` | Raw UED author-facing fields, legacy `result.*` renderer helpers |
| DOCX renderer | `evaluation_report_view_model_v1` | Raw UED author-facing fields, renderer-side sanitizers |
| TXT renderer | `evaluation_report_view_model_v1` | Raw UED author-facing fields, renderer-side recounters |
| DREAM long-form synthesis | Certified long-form artifacts as explicitly governed | ViewModel as a prompt authority or renderer substitute |
| Revise Queue | `revision_opportunity_ledger_v1` derived from certified UED | ViewModel, renderer output |
| Agent Readiness | Certified UED + ledger + decisions | ViewModel, raw chunks, pass artifacts |

---

## ViewModel Boundary Rule

All author-facing report interpretation happens once:

```text
Certified UED → normalizeEvaluationReportViewModel() → evaluation_report_view_model_v1
```

The ViewModel owns:

- author-facing text sanitization
- scope-language correction
- confidence formatting
- score palette derivation
- section shaping
- criterion detail shaping
- recommendation/opportunity counting
- render-ready labels and display values

Renderers own only:

- layout
- typography
- escaping required by output format
- page breaks
- file-format structures

Renderers must not:

- re-sanitize ViewModel-owned text
- re-score
- re-count opportunities
- re-order template-owned sections
- synthesize fallback recommendations
- read raw UED author-facing fields after ViewModel normalization

---

## Correct Runtime Spine Interpretation

The Evaluation SIPOC runtime spine should be interpreted as:

```text
Persistence
    ↓
Phase 5 Author Exposure Gate
    ↓
ViewModel Boundary Gate
    ↓
evaluation_report_view_model_v1
    ↓
Renderer (Webpage)
    ↓
Download Pipeline (PDF/DOCX/TXT)
```

The download pipeline is a renderer surface. It does not become a second canonical report brain.

---

## DREAM Clarification

DREAM is not part of the renderer ViewModel boundary.

DREAM remains a long-form synthesis and validation asset governed by its own DREAM contracts. It may validate expected long-form/multi-layer behavior, but it must not define report structure or override the evaluation templates, contract registry, UED certification, or ViewModel boundary.

DREAM enrichment is intentionally deferred until after:

1. Authority Chain alignment
2. SIPOC/FIPOC registry sync
3. executable contract registry alignment
4. golden fixtures / renderer parity
5. Revise + Agent Readiness authority unification

---

## Parent SIPOC Reconciliation Note

If `docs/SIPOC_EVALUATION_PROCESS.md` says:

```text
All renderers ... consume ... through UnifiedEvaluationDocument
```

read that as stale pre-Phase-4b language. The binding interpretation is now:

```text
Certified UED → EvaluationReportViewModel → Renderers
```

A future consolidated parent-SIPOC rewrite should fold this addendum into `docs/SIPOC_EVALUATION_PROCESS.md` and remove the stale wording directly.
