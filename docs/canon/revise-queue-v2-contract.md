# RevisionGrade Revise Queue V2 Contract

## Purpose

This document defines the canonical Revise Queue V2 artifact contract.

A Revise Queue item is not a recommendation paragraph. It is not a report section. It is not an editor note masquerading as a rewrite.

A Revise Queue item is:

> Six-part diagnostic brief + three executable manuscript options.

The six-part diagnostic explains the issue.  
The A/B/C options enact the repair.

This distinction is mandatory.

---

## Core Product Rule

The Revise Queue must never mix diagnosis and revision prose.

### Diagnostic area

The diagnostic area may contain:

1. Symptom
2. Cause
3. Fix Strategy
4. Reader Impact
5. Evidence
6. Operation / Targeting

### A/B/C option area

The A/B/C option area must contain actual manuscript prose only.

A/B/C must not contain:

- diagnosis
- rationale
- expected benefit
- criterion explanation
- issue restatement
- recommendation summary
- operation instruction
- internal artifact key
- scoring language
- "this will..." statements
- "the author should..." statements
- "readers will..." statements

---

## Required TypeScript Contract

```ts
export type RevisionPriority = "must" | "should" | "could";

export type RevisionReadiness =
  | "ready_for_revise"
  | "needs_targeting"
  | "invalid";

export type RevisionOptionKey = "A" | "B" | "C";

export type RevisionOptionRole =
  | "recommended_repair"
  | "rhythm_variant"
  | "bolder_rendering_shift";

export type RevisionOperation =
  | "replace_selected_passage"
  | "insert_before_selected_passage"
  | "insert_after_selected_passage"
  | "rewrite_full_paragraph"
  | "rewrite_multi_paragraph_span"
  | "compress_selected_passage"
  | "delete_selected_passage"
  | "split_paragraph"
  | "merge_paragraphs"
  | "reorder_within_section"
  | "needs_targeting";

export type RevisionTarget = {
  chapter?: string;
  section?: string;
  location_label?: string;
  anchor_text?: string;
  selected_text?: string;
  before_text?: string;
  after_text?: string;
  start_offset?: number;
  end_offset?: number;
};

export type RevisionDiagnostic = {
  symptom: string;
  cause: string;
  fix_strategy: string;
  reader_impact: string;
  evidence: {
    quoted_excerpt?: string;
    location_label?: string;
    artifact_source?: string;
    criterion_source?: string;
  };
  operation_note: string;
  mistake_proofing?: string;
};

export type RevisionOption = {
  key: RevisionOptionKey;
  role: RevisionOptionRole;
  label: string;
  candidate_text: string;
  rationale?: string;
  risk_flags?: string[];
};

export type RevisionOpportunityV2 = {
  id: string;
  contract_version: "revise_queue_v2";

  manuscript_id: string;
  evaluation_job_id: string;

  priority: RevisionPriority;
  criterion: string;
  operation: RevisionOperation;
  readiness: RevisionReadiness;

  issue_statement: string;
  diagnostic: RevisionDiagnostic;
  target: RevisionTarget;

  options: RevisionOption[];

  created_at: string;
  source: "evaluation" | "deep_revision" | "manual" | "regenerated";
};
```

---

## Compatibility With Existing WorkbenchOpportunity

If the existing application still uses `WorkbenchOpportunity`, map fields as follows:

| V2 Canon Field | Existing Field |
|---|---|
| `priority` | `severity` |
| `diagnostic.symptom` | `symptom` |
| `diagnostic.cause` | `cause` |
| `diagnostic.fix_strategy` | `fixDirection` |
| `diagnostic.reader_impact` | `readerEffect` |
| `diagnostic.mistake_proofing` | `mistakeProofing` |
| `diagnostic.evidence.quoted_excerpt` | `quoteHighlight + quoteRest` |
| `diagnostic.evidence.location_label` | `anchor` |
| `operation` | `revisionOperation` |
| `options[].candidate_text` | `options[].text` until renamed |

Temporary compatibility is acceptable, but the semantic contract is not optional:

> `options[].text` must be treated as `candidate_text`, not as a recommendation field.

---

## A/B/C Option Roles

### A — Recommended Repair

The safest default repair.

Rules:

- preserves author intent
- least disruptive
- directly solves the diagnosed issue
- suitable for one-click acceptance

### B — Rhythm Variant

Same repair goal, different cadence.

Rules:

- preserves the same meaning
- changes rhythm, pacing, beat shape, or emphasis
- does not become a new diagnosis

### C — Bolder Rendering Shift

A stronger but still manuscript-safe rendering.

Rules:

- may alter image, camera angle, beat structure, or emotional weighting
- remains faithful to the scene
- does not introduce unsupported plot facts

---

## Required Labels

```ts
export const REVISION_OPTION_LABELS = {
  A: "A — Recommended Repair",
  B: "B — Rhythm Variant",
  C: "C — Bolder Rendering Shift",
} as const;
```

---

## Operation Semantics

### `replace_selected_passage`

`candidate_text` replaces `target.selected_text`.

### `insert_after_selected_passage`

`candidate_text` is inserted after `target.anchor_text` or `target.selected_text`.

### `insert_before_selected_passage`

`candidate_text` is inserted before `target.anchor_text` or `target.selected_text`.

### `rewrite_full_paragraph`

`candidate_text` replaces the full target paragraph.

### `rewrite_multi_paragraph_span`

`candidate_text` replaces a defined multi-paragraph span.

If no exact span exists, route to `needs_targeting`.

### `compress_selected_passage`

`candidate_text` is a shorter replacement for the selected passage.

### `delete_selected_passage`

The card may render a deletion preview, but it must not pretend that a prose replacement exists unless one is provided.

### `split_paragraph`

`candidate_text` shows the revised paragraph split.

### `merge_paragraphs`

`candidate_text` shows the merged version.

### `reorder_within_section`

`candidate_text` shows the reordered sequence.

### `needs_targeting`

No ready A/B/C cards may render.

The item must appear in the Needs Targeting queue until it has:

- exact target
- evidence
- operation
- three valid candidate texts

---

## Readiness Rules

An item is `ready_for_revise` only when all are true:

1. It has a non-empty issue statement.
2. It has a valid operation.
3. It has exact target text or exact target location.
4. It has evidence or an explicit manuscript-wide scope.
5. It has exactly three A/B/C options.
6. Each option has valid candidate prose.
7. No candidate repeats the issue statement.
8. No candidate contains meta-editorial language.
9. A/B/C are materially distinct.
10. No internal artifact key leaks into author-facing copy.

Otherwise it is `needs_targeting`.

---

## Candidate Text Validation

Candidate text must be manuscript prose.

Reject if it contains meta-editorial patterns such as:

```ts
const META_EDITORIAL_PATTERNS = [
  /\bshould\b/i,
  /\bcould\b/i,
  /\bwould\b/i,
  /\bwill\b/i,
  /\bwill improve\b/i,
  /\bwill sharpen\b/i,
  /\bgives readers\b/i,
  /\bshows\b/i,
  /\bexpand\b/i,
  /\bclarify\b/i,
  /\bstrengthen\b/i,
  /\bfix(?:es)?\b/i,
  /\brepair(?:s)?\b/i,
  /\bkeeps? momentum\b/i,
  /\bcausal engine\b/i,
  /\bprimary repair path\b/i,
  /\bsecondary variant\b/i,
  /\balternative variant\b/i,
  /\bfrom the evaluation\b/i,
  /\brecommended repair\b/i,
  /\brhythm variant\b/i,
  /\bbolder rendering\b/i,
  /\bsuggested replacement\b/i,
  /\bpreserve author voice\b/i,
  /\bapply the same repair goal\b/i,
  /\breview this opportunity\b/i,
];
```

Reject if it contains internal artifact leakage:

```ts
const INTERNAL_ARTIFACT_PATTERNS = [
  /\b[A-Z]{3,}:[a-z_]+\b/,
  /\bevaluation_result\b/i,
  /\bcriteria\.recommendations\b/i,
  /\bprosecontrol\b/i,
  /\bnarrativedrive\b/i,
  /\bprovenance\b/i,
];
```

Reject if candidate text substantially overlaps with the issue statement.

---

## Renderer Rule

The renderer must display:

```ts
option.candidate_text
```

or, during compatibility:

```ts
option.text
```

only when `option.text` has passed candidate prose validation.

Never render these fields inside the A/B/C prose block:

- `title`
- `issue_statement`
- `symptom`
- `cause`
- `fixDirection`
- `readerEffect`
- `mistakeProofing`
- `recommendation`
- `diagnosis`
- `operation`
- `rationale`

---

## UI Rendering Model

Each ready item should render:

```text
Priority · Criterion · Operation · Readiness

Issue
[issue statement]

Diagnostic Brief
Symptom
Cause
Fix Strategy
Reader Impact
Evidence
Operation / Targeting
Mistake-proofing

A — Recommended Repair
[actual manuscript prose]

B — Rhythm Variant
[actual manuscript prose]

C — Bolder Rendering Shift
[actual manuscript prose]
```

---

## Non-Negotiable Rule

The author should be able to click **Accept A**, **Accept B**, or **Accept C** and understand exactly what text is being applied to the manuscript.

If the text cannot be applied, it is not a Revise Queue candidate.

Route it to Needs Targeting.
