# PR #292 — Chunk-Aware Evidence Consumption
## Execution Brief (Implementation Hold Until #291 Green)

## Status
Hold: Do not implement until #291 provenance artifacts (`final_text_source`, `post_chunk_reresolved`, final-text provenance test) land with green CI.

Scope class: Representation-truth only.

Causal position: Direct continuation of #291. Sits between long-form source unification and any future WAVE / packet redesign work.

## Purpose
Prove that downstream long-form evaluation actually consumes chunk-derived evidence in a controlled, observable, test-proven way, while short-form behavior remains unchanged. This converts #291's canonical-source guarantee into a downstream consumption guarantee.

## Scope (in)
- Chunk-aware comparison packet construction for long-form.
- Chunk-derived evidence aggregation feeding packets.
- Divergence-preserving packet growth so long-form packets retain richness instead of collapsing to a single representation.
- Packet/evidence provenance telemetry (additive only).
- Tests proving long-form downstream consumption of chunk-derived evidence.
- Short-form non-regression confirmation.

## Non-goals (out)
- Any remaining #291 source-unification work.
- WAVE activation or expansion logic.
- Prompt redesign.
- Scoring or Quality Gate changes.
- UI / report rewrites beyond additive telemetry surfacing.
- Broad long-form framework expansion.

## File Targets (expected)
Implementation should touch a narrow surface:

- Packet construction module (e.g., `buildComparisonPacket()` and adjacent helpers).
- Evidence aggregation path consuming chunk-derived material post-Routing/Chunking.
- `processor.ts` — additive telemetry emission only; no routing changes.
- Test files — new long-form packet consumption tests + short-form non-regression tests.
- Telemetry/types module — add provenance field definitions.

If implementation requires changes outside this surface, it is out of scope and should be split into a separate PR.

## Telemetry Contract — SIPOC Instrument (LOCKED)

### Provenance fields (input identity)

| Field | Long-form | Short-form |
| --- | --- | --- |
| `packet_source` | `long_form_chunks_canonical` | `short_form_initial_text` |
| `packet_scope` | `criterion_comparison` | `criterion_comparison` |
| `packet_evidence_origin` | `chunk_canonical_window` | `short_form_full_text` |

### Input-side coverage metrics (what entered each stage)

| Field | Type | Long-form value | Short-form value |
| --- | --- | --- | --- |
| `manuscript_words` | number | total word count | total word count |
| `chunks_created` | number | persisted chunk count | 0 |

### Output-side coverage metrics (what each stage produced)

| Field | Type | Long-form | Short-form |
| --- | --- | --- | --- |
| `chunks_consumed` | number | count read by packets | null |
| `chunk_coverage_pct` | number (0–100) | `chunks_consumed / chunks_created * 100` | null |
| `excerpt_count` | number | total excerpts across packets | full-text excerpt count |
| `evidence_count_by_criterion` | `Record<string, number>` | per-criterion counts | per-criterion counts |
| `comparison_packet_chars` | number | total packet chars | total packet chars |
| `representation_compression_ratio` | number | `packet_chars / total_chunk_chars` | `packet_chars / manuscript_chars` |
| `criteria_with_zero_evidence` | `string[]` | criteria with 0 evidence | criteria with 0 evidence |

### TypeScript interface

```typescript
export interface RepresentationTelemetry {
	// Provenance
	packet_source: 'long_form_chunks_canonical' | 'short_form_initial_text';
	packet_scope: 'criterion_comparison' | 'manuscript_summary' | 'divergence_packet';
	packet_evidence_origin: 'chunk_canonical_window' | 'short_form_full_text';

	// Input-side coverage
	manuscript_words: number;
	chunks_created: number;

	// Output-side coverage
	chunks_consumed: number | null;
	chunk_coverage_pct: number | null;
	excerpt_count: number;
	evidence_count_by_criterion: Record<string, number>;
	comparison_packet_chars: number;
	representation_compression_ratio: number;
	criteria_with_zero_evidence: string[];
}
```

Constraints:
- All fields additive. Do not mutate existing `chunk_routing.*` or `final_text_source` / `post_chunk_reresolved` semantics from #404.
- For long-form: every field must emit with non-null, sensible value.
- For short-form: input-side fields emit; output-side chunk-coverage fields may be null where chunk-aware paths don't apply.
- No field may be emitted with a placeholder/`unknown` string for long-form.

## Required Tests
Four minimum tests for closure:

1. **Long-form downstream consumption test**
	- Name suggestion: `long_form_packet_consumes_chunk_derived_evidence`
	- Assertion: For a long-form manuscript, the downstream packet/evidence structure passed into evaluation contains data sourced from chunk-derived canonical material — not pre-chunk text or legacy paths.

2. **Provenance telemetry test**
	- Name suggestion: `long_form_packet_provenance_telemetry_emitted`
	- Assertion: A long-form run emits `packet_source = "long_form_chunks_canonical"`, `packet_scope = "criterion_comparison"`, and `packet_evidence_origin = "chunk_canonical_window"`.

3. **Short-form non-regression test**
	- Name suggestion: `short_form_packet_behavior_unchanged`
	- Assertion: Short-form packet construction and emitted telemetry remain semantically unchanged from pre-#292 behavior.

4. **SIPOC coverage diagnostics test**
	- Name: `long_form_emits_full_sipoc_coverage_diagnostics`
	- Assertions:
		- All 12 telemetry fields present in long-form telemetry payload.
		- `chunk_coverage_pct` ∈ [0, 100].
		- `representation_compression_ratio` ∈ (0, 1).
		- `evidence_count_by_criterion` is non-empty record for long-form.
		- `criteria_with_zero_evidence` is array (may be empty).
	- Short-form variant: `short_form_emits_input_side_coverage_only` — input-side fields present, output-side chunk-coverage fields null.

## Acceptance Bar (4-Point Gate)
Maps 1:1 to `PR_292_ADJUDICATION_TEMPLATE.md`:

1. Identifiable long-form packet/evidence path in code — reviewer can name the function.
2. Runtime provenance telemetry — three fields present with correct values for long-form.
3. Tests prove chunk-derived evidence consumption — not just chunk existence or routing.
4. Short-form unchanged + CI/typecheck green.

All four must pass. No partial credit. Failure → narrow follow-up patch.

## Reviewer Checklist
Paste this into the PR description:

- Only changes chunk-aware downstream packet/evidence consumption for long-form.
- No remaining #291 routing/source-recovery work folded in.
- No WAVE activation, prompt redesign, scoring/QG rewrite, or UI rewrite.
- Long-form packet/evidence path is explicitly identifiable in code.
- Telemetry emits `packet_source`, `packet_scope`, `packet_evidence_origin` with correct long-form values.
- Test asserts downstream consumption of chunk-derived evidence (not chunk existence alone).
- Test asserts provenance telemetry values for long-form.
- Test asserts short-form behavior unchanged.
- CI + typecheck green.

## Causal Attribution Guarantee
By keeping #292 strictly to representation-truth, any subsequent improvement (or regression) in long-form evaluation quality can be attributed cleanly to chunk-aware evidence consumption rather than to source-unification side effects, prompt drift, scoring changes, or unrelated framework expansion. This is the entire reason for the narrow scope.

## Trigger Condition
Implementation begins when all of the following are true:

- #291 architecturally closed via `PR_291_ADJUDICATION_TEMPLATE.md` PASS.
- `final_text_source` and `post_chunk_reresolved` confirmed live in runtime telemetry.
- Final-text provenance test green in CI.

Until then: brief is staged, implementation is held.

## What to tell GitHub
Paste this comment to Issue #292 alongside the existing directive:

`PR_292_EXECUTION_BRIEF.md` is now pre-staged with file targets, telemetry schema (`packet_source`, `packet_scope`, `packet_evidence_origin`), required test names and assertions, and the 4-point acceptance gate. Implementation remains on hold until #291 provenance artifacts (`final_text_source`, `post_chunk_reresolved`, final-text provenance test) land green. The moment #291 closes architecturally, #292 implementation can begin with zero ramp-up against this brief. Do not expand scope beyond representation-truth changes.

Brief is now fully staged. Next move: disciplined waiting on #291's provenance reply. When it lands, stamp with `PR_291_ADJUDICATION_TEMPLATE.md` and either lift the hold (PASS) or paste Variant A/B (FAIL).