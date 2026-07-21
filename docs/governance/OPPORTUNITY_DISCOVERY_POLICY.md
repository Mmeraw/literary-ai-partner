# Opportunity Discovery Policy (ODP v1.0)

**Status:** Canonical governance authority  
**Applies to:** Short-Form Evaluation, Long-Form Multi-Layer Evaluation, WAVE discovery, UED assembly, revision opportunity ledgers, web/PDF/DOCX/TXT rendering, quality gates, forensic diagnostics, and AI-agent implementation work.  
**Authority:** This document is the controlling policy for opportunity discovery and rendering. Where any prompt, validator, fallback, repair, renderer, WAVE component, diagnostic, or agent instruction conflicts with this document, this document prevails.
**Executable authority:** `lib/evaluation/policy/opportunityDiscoveryPolicy.ts`, registered by `OPPORTUNITY_DISCOVERY_POLICY_V1` in `lib/evaluation/fipocRegistry.ts`. All live Pass 2, Pass 3, certification, and persistence consumers must call the executable authority rather than recreate its status vocabulary, meaningful-recommendation predicate, or cardinality rules.

## 1. Governing principle

Revision opportunities are **discoveries, not quotas**.

Every opportunity rendered to an author MUST correspond to a unique, manuscript-grounded editorial finding. Opportunity count is the result of editorial discovery, not an objective to be achieved.

The system MUST NOT:

- invent an opportunity to satisfy a numerical target;
- split one defect into multiple opportunities;
- duplicate the same diagnosis under different criteria or wording;
- manufacture advice because a score is below a threshold;
- treat an unused opportunity allowance as missing output;
- classify a valid low-count result as a pipeline defect merely because a target range was not reached.

## 2. Definitions

### 2.1 Opportunity

A distinct, evidence-supported editorial finding that identifies:

1. exact manuscript evidence;
2. an observable symptom;
3. a causal mechanism distinct from the symptom;
4. a concrete revision direction;
5. a plausible reader effect; and
6. a preservation or harm guardrail where relevant.

### 2.2 Editorial opportunity

An opportunity discovered through the thirteen canonical evaluation criteria and grounded directly in the submitted manuscript body.

### 2.3 WAVE opportunity

An opportunity discovered through one or more canonical WAVE analyses in Long-Form Multi-Layer Evaluation. WAVE opportunities are not available in Short Form.

### 2.4 Cross-WAVE opportunity

A higher-order opportunity produced by reconciling recurring findings across multiple WAVE analyses. It MUST represent a distinct strategic lever, not a restatement of its source findings.

### 2.5 Opportunity budget

The maximum number of opportunities the product may render. A budget is a ceiling, never a fill target.

### 2.6 Suppressed opportunity

A candidate withheld because it lacks evidence, duplicates another finding, conflicts with genre or authorial intent, creates more harm than benefit, or cannot be made safely actionable.

Suppression is correct behavior and MUST NOT be treated as missing output.

## 3. Product contracts

### 3.1 Short-Form Evaluation

Short Form evaluates only the submitted text.

Permitted opportunity sources:

- criterion editorial discovery.

Excluded opportunity sources:

- WAVE discovery;
- cross-WAVE synthesis;
- full-manuscript story-engine discovery;
- portfolio-level structural analysis.

The Short-Form opportunity budget is **50 total opportunities maximum**.

This is a hard ceiling, not a target. A 200-word passage may correctly produce zero or only a few opportunities. A 20,000-word short-form submission may naturally produce many more.

### 3.2 Long-Form Multi-Layer Evaluation

Long Form evaluates the manuscript holistically and may combine:

- criterion editorial discoveries;
- 64+ WAVE discoveries;
- cross-WAVE synthesis;
- structural and story-engine discoveries;
- market-readiness discoveries;
- manuscript-wide continuity, setup/payoff, motif, relationship, escalation, and arc findings.

The Long-Form opportunity budget is **100 total opportunities maximum**.

This is a hard ceiling, not a target. Long Form will naturally produce more opportunities than Short Form because its WAVE and cross-manuscript discovery layers examine dimensions that Short Form does not run.

## 4. Score guidance

Score ranges guide expected discovery effort. They are not mandatory counts.

### 4.1 Short Form

| Score | Expected discovery range | Required behavior |
|---:|---:|---|
| 10 | 0–1 | Zero is normal. Emit one only when independently supported. |
| 9 | 0–1 | Zero is allowed. One genuine minor opportunity is sufficient. |
| 8 | 1–2 | Prefer at least one when evidence supports it; never invent a second. |
| 7 | 1–3 | Surface distinct supported issues; one may be sufficient for very short text. |
| 6 | 2–4 | Search more deeply, but do not fabricate. |
| 5 or below | 3–5 | Weak execution should normally yield several findings, subject to evidence and length. |

### 4.2 Long Form

| Score | Expected discovery range | Required behavior |
|---:|---:|---|
| 10 | 0–1 | Zero is normal; mastery does not require advice. |
| 9 | 0–2 | One is sufficient; a second requires distinct evidence. |
| 8 | 1–4 | Find supported passage- or pattern-level opportunities. |
| 7 | 3–5 | A recurring weakness across a full manuscript should normally yield several distinct findings. |
| 6 | 3–6 | Search across zones and WAVE outputs for distinct high-leverage findings. |
| 5 or below | 5–8 | Major weakness should normally materialize repeatedly, but the range remains evidence-dependent. |

A lower-than-expected count MUST trigger a search for overlooked evidence, not deterministic backfill. If no additional valid opportunity exists, the lower count is accepted.

## 5. Length-aware plausibility

Word count constrains how many distinct findings can plausibly exist in one criterion.

Suggested per-criterion ceilings for Short Form:

| Submitted manuscript body length | Maximum per criterion |
|---:|---:|
| 200–499 words | 1 |
| 500–1,999 words | 2 |
| 2,000–4,999 words | 3 |
| 5,000–24,999 words | 4 |

These are ceilings, not requirements. The policy MUST use manuscript-body word count, excluding titles and metadata.

Long Form is governed primarily by evidence distinctness, WAVE provenance, cross-zone coverage, and the 100-opportunity product ceiling.

## 6. Evidence and entailment contract

An opportunity may render only when all conditions are satisfied:

1. **Exact evidence:** Quoted evidence MUST be an exact contiguous passage from the manuscript body. The pipeline may normalize quotation-mark encoding for matching, but MUST render the exact manuscript slice.
2. **Correct source domain:** Titles, metadata, synopsis text, genre labels, and project names MUST NOT be rendered as manuscript-body evidence. Title analysis must be explicitly labeled as title evidence.
3. **Evidence-to-symptom entailment:** The evidence MUST demonstrate the claimed reader-facing symptom.
4. **Symptom-to-cause distinction:** Cause MUST explain why the symptom occurs. It MUST NOT repeat or lightly paraphrase the symptom.
5. **Cause-to-fix alignment:** The proposed revision MUST address the stated cause.
6. **Reader-effect validity:** The expected reader effect MUST plausibly follow from the proposed change.
7. **Harm test:** The expected benefit MUST outweigh potential damage to voice, ambiguity, atmosphere, pacing mode, characterization, theme, or authorial intent.
8. **Distinctness:** The opportunity MUST not duplicate an existing opportunity's anchor, issue family, strategic lever, and intended outcome.

Failure of any condition requires suppression, regeneration, or explicit non-recommendation status. It MUST NOT trigger canned fallback advice.

## 7. Opportunity suppression and status metadata

A criterion may correctly return no opportunities.

Allowed governed statuses:

- `recommendation_provided`
- `no_recommendation_warranted`
- `genre_appropriate_no_revision_warranted`
- `criterion_not_applicable`
- `insufficient_evidence`
- `gate_suppressed_no_safe_recommendation`

For scores 9–10, zero opportunities is valid when accompanied by a substantive rationale or governed status.

For weak criteria, an empty opportunity list MUST NOT be silent. The criterion must either provide at least one supported opportunity or explain why evidence or safety prevented one.

The status/cardinality contract is:

| Status | Zero recommendations allowed | Recommendations allowed | Rationale required | Invalid combination recovery |
|---|---:|---:|---:|---|
| `recommendation_provided` | No | Yes | No | One bounded Pass 3 retry |
| `no_recommendation_warranted` | Yes | No | Yes | One bounded Pass 3 retry |
| `genre_appropriate_no_revision_warranted` | Yes | No | Yes | One bounded Pass 3 retry |
| `criterion_not_applicable` | Yes | No | Yes | One bounded Pass 3 retry |
| `insufficient_evidence` | Yes | No | Yes | One bounded Pass 3 retry |
| `gate_suppressed_no_safe_recommendation` | Yes | No | Yes | One bounded Pass 3 retry |

An omitted or unknown status always fails closed at every live producer, replay, certification, and persistence boundary. Historical payloads may be rendered only through non-authoritative archival readers; they cannot re-enter evaluation or Revise authority without explicit migration to the current contract.

`confidence_level` describes confidence in the criterion diagnosis. It is not intervention confidence and MUST NOT grant recommendation admission, invalidate an otherwise governed `insufficient_evidence` disposition, or manufacture queue work. Evidence-anchor counts and snippet length are likewise observational unless a separate grounding contract proves source membership and actionability.

### 7.1 Pass 2 cache and aggregation authority

`pass2_chunk_cache_v1` is resumable execution evidence, not timeless recommendation authority.

- The cache-level `source_hash` MUST match the current job/manuscript/chunk identity before any entry is offered for reuse.
- A reused entry MUST carry the current `PASS2_PROMPT_VERSION` and satisfy this policy's disposition contract for every criterion.
- A cache-level source mismatch invalidates the cache. A prompt-version or disposition mismatch invalidates only the affected entry.
- An invalid entry MUST be regenerated from the same source chunk. The processor MUST NOT repair it by copying recommendations from another artifact or bypassing the canonical validator.
- Chunk aggregation MUST preserve the governed status and required rationale. Conflicting zero-recommendation statuses fail closed before the Pass 1/2 handoff.

Required Pass 2 observability includes cache hits/misses, source-hash rejection, prompt-version rejection, disposition rejection, source-chunk regeneration, and aggregate disposition conflict count.

### 7.2 Kickback, exhaustion, and terminal ownership

A pure recommendation-status/cardinality defect is classified as `CRITERION_OPPORTUNITY_COVERAGE_INVALID`. It may requeue the full Pass 3 synthesis exactly once. The durable retry owner is:

```text
evaluation_jobs.progress.kick_attempts.CRITERION_OPPORTUNITY_COVERAGE_INVALID
```

That counter survives worker re-entry and replay. When it reaches one, the defect is exhausted and MUST NOT fall through to the separate generic Phase 3 crash-retry path.

If any unrelated critical template defect is present alongside an opportunity-coverage defect, the combined failure remains `TEMPLATE_COMPLETENESS_GATE_FAILED`, is terminal, and receives no specialized recommendation retry. Exhausted, mixed, and unrelated template failures MUST invoke neither canonical evaluation persistence nor Revise projection.

## 8. Opportunity-budget accounting

The canonical ledger SHOULD expose discovery accounting without implying a fill requirement:

```text
Editorial discoveries        31
WAVE discoveries             38
Cross-WAVE discoveries       17
Market discoveries            8
Duplicate suppression        -4
Final opportunity ledger     90
Product ceiling             100
```

The ledger MUST preserve provenance for every retained opportunity and suppression reason for every removed candidate.

## 9. Deduplication and allocation

When multiple criteria or WAVE analyses identify the same strategic lever:

- retain one canonical opportunity;
- assign it to the strongest evidence and most appropriate primary criterion or WAVE;
- record secondary criterion/WAVE tags;
- do not render separate cards merely to increase coverage counts.

The global budget SHOULD be allocated toward the highest-leverage and best-supported opportunities rather than evenly across criteria.

## 10. Renderer requirements

Web, PDF, DOCX, TXT, Revise Workbench, and queue surfaces MUST render from the same canonical opportunity ledger.

Renderers MUST NOT:

- create or repair substantive recommendations;
- elevate metadata to evidence;
- show density warnings for valid high-score low-count criteria;
- label an unused opportunity budget as missing content;
- restore a candidate suppressed by governance.

Renderer summaries SHOULD distinguish:

- editorial opportunities;
- WAVE opportunities;
- cross-WAVE opportunities;
- suppressed duplicates;
- final rendered total.

## 11. Quality objectives

The primary quality objective is **editorial discovery accuracy**:

> Discover every material, evidence-supported opportunity and no imaginary ones.

Recommendation count alone is not a quality metric.

Useful metrics include:

- exact-evidence rate;
- evidence-to-diagnosis entailment rate;
- symptom/cause distinction rate;
- duplicate suppression rate;
- cross-zone coverage for long form;
- retained-opportunity provenance completeness;
- unsupported-opportunity escape rate;
- author acceptance and rejection patterns.

## 12. Implementation authority

Production code MUST expose a single canonical policy module. Prompts, validators, diagnostics, UED assembly, WAVE systems, and renderers MUST consume that authority rather than embedding independent score/count rules.

At minimum, the following areas are governed:

- Pass 1/Pass 2 recommendation generation;
- Pass 3 synthesis and reconciliation;
- recommendation integrity and grounding gates;
- template completeness and quality gates;
- WAVE and cross-WAVE opportunity generation;
- canonical opportunity ledger and Revise ledger seeding;
- UED and render-manifest assembly;
- web/PDF/DOCX/TXT renderers;
- forensic and pipeline diagnostics;
- Devin, Perplexity, GitHub Copilot/Codex, and other agent instructions.

## 13. Agent instruction

Any AI agent changing evaluation or revision code MUST:

1. read this document before editing opportunity-related code;
2. identify all embedded count rules in the affected path;
3. use the canonical TypeScript policy module;
4. preserve discovery-over-quota semantics;
5. add regression tests proving no recommendation is fabricated to satisfy a count;
6. report conflicts between legacy documentation and this policy rather than silently preserving them.

## 14. Required regression coverage

The repository MUST prove at least the following:

- 200-word, 9/10 criterion, zero opportunities plus `no_recommendation_warranted` passes;
- 200-word, 9/10 criterion, one valid opportunity passes;
- 1,500-word, 9/10 criterion, one valid opportunity passes without a density defect;
- 9/10 with two near-duplicate opportunities retains one and does not backfill;
- 10/10 may render zero opportunities;
- 6/10 with no opportunity and no governed status fails closed;
- 6/10 with `insufficient_evidence` and concrete rationale passes with disclosure;
- 6/10 with High diagnostic confidence, evidence anchors, and a valid `insufficient_evidence` rationale passes and remains available for editorial calibration;
- recommendation present plus `insufficient_evidence` or a safety-suppression status fails closed;
- no recommendation plus `recommendation_provided` fails closed;
- one valid recommendation elsewhere in the report does not mask missing or contradictory coverage on another scored criterion;
- only `CRITERION_OPPORTUNITY_COVERAGE_INVALID` receives the bounded Pass 3 recovery; generic template-completeness failures remain terminal;
- Short Form never receives WAVE opportunities;
- Long Form may combine editorial, WAVE, and cross-WAVE opportunities up to 100;
- no renderer creates opportunities absent from the canonical ledger.

## 15. Change control

Changes to opportunity ceilings, product sources, score guidance, or governed statuses require:

- an update to this document;
- an update to the canonical TypeScript policy module;
- producer/checker parity tests;
- renderer parity tests;
- an explicit migration note for conflicting legacy rules.
