# What Not To Do — Phase 0 Runtime Doctrine Map

Status: canonical warmup packet v1  
Purpose: compact map of known failure classes, enforcement locations, benchmark references, and runtime consequences.

This file is not a replacement for code guardrails. It is the operating map that tells Phase 0 which hard rules, benchmark targets, and quality gates must be respected before SEED, Phase 1A, Review Gate, and Phase 2.

## Core principle

Do not fail open.

If an artifact, layer, handoff, or revision operation does not meet its required contract, RevisionGrade must block, suppress, degrade with proof, or kick back for regeneration. It must not render substandard output as author-approvable truth.

---

# 1. Seed authority failures

## Do not treat SEED as authority

- Rule: SEED proposes baseline scaffolds only.
- Enforced by: seed artifact contracts, seedCompletenessGuard, accepted_story_ledger_v1 requirement.
- Runtime consequence: seed claims must remain proposed/unverified until Phase 1A verifies against manuscript evidence and Review Gate authorizes.
- Never do: persist seed facts as governing story truth.

## Do not start Phase 1A with incomplete seed artifacts

- Rule: both story_map_seed_v1 and evaluation_seed_v1 must be complete.
- Enforced by: seedCompletenessGuard / phase1aSeedRuntimeGate.
- Runtime consequence: create seed_fit_gap_report_v1 and block with SEED_FIT_GAP_BLOCKED.
- Never do: run chunk extraction from generic seed claims or partial template routing.

## Do not allow seed to contain final scores or verdicts

- Rule: seed may scaffold criteria and report shape, but may not produce final craft scores or executive verdicts.
- Enforced by: evaluation_seed_v1 contract and seedCompletenessGuard.
- Runtime consequence: fail seed fit-gap if final-score/final-verdict fields appear.

---

# 2. Story Ledger rendering failures

## Do not render dirty Story Ledger layers

- Rule: Story Ledger layers are not allowed to fail open.
- Enforced by: Story Layer Quality Gate.
- Benchmark references: docs/benchmarks/story-ledger/.
- Runtime consequence: valid, degraded_with_caution, suppressed_insufficient_evidence, suppressed_conflicting_signals, or failed_benchmark_minimum.
- Never do: render weak extraction as author-approvable truth.

## Do not open Review Gate with failed benchmark-minimum layers

- Rule: author approval must not be requested for layers that fail governing benchmark minimums.
- Enforced by: ledger_quality_report_v1 and Review Gate readiness.
- Runtime consequence: block Review Gate or show controlled suppressed/degraded state.

## Do not claim “No POV characters identified” when focal centers exist

- Rule: empty POV is valid only when evidence supports an intentionally non-focal structure.
- Enforced by: POV layer validator, benchmark minimums, regression tests.
- Runtime consequence: suppress/degrade POV Structure if obvious focal centers are missing.

## Do not show stable pronoun use as reviewable pronoun transition

- Rule: stable he/him, she/her, they/them usage belongs in hidden normalization, not author burden.
- Enforced by: pronoun layer validator.
- Runtime consequence: render valid empty state: “No reviewable pronoun-family transitions detected.”

## Do not collapse named relationships into generic pressure

- Rule: sustained named relationships must remain visible in Relationship Network.
- Enforced by: benchmark-specific Story Ledger checks.
- Runtime consequence: fit-gap if benchmark-required relationships are missing.

## Do not treat story-bearing objects as scenery

- Rule: objects that drive identity, pressure, plot, symbolism, or ending accountability belong in Object / Symbol.
- Enforced by: benchmark-specific object requirements and Story Layer Quality Gate.
- Runtime consequence: degrade or block Object / Symbol if required objects are omitted.

## Do not show machine chunk labels to authors

- Rule: machine locators are private traceability only.
- Enforced by: display locator sanitizer and UI renderer.
- Runtime consequence: use chapter, scene, paragraph, page, or quoted evidence anchor.

---

# 3. Phase handoff failures

## Do not start Phase 2 without accepted_story_ledger_v1

- Rule: Phase 2 story authority is accepted_story_ledger_v1.
- Enforced by: Phase 2 handoff guard.
- Runtime consequence: refuse Phase 2 until Review Gate completes or documented degraded authority is accepted by policy.

## Do not use Golden Record as separate persisted artifact unless mapped to accepted_story_ledger_v1

- Rule: “Golden Record” is doctrine language only unless explicitly mapped.
- Enforced by: artifact registry and handoff docs.
- Runtime consequence: avoid terminology split-brain.

## Do not trust half-written artifacts

- Rule: downstream phases require complete artifacts with expected type, version, content, status, and source hash.
- Enforced by: artifact validators and handoff guards.
- Runtime consequence: block, retry, or create fit-gap report.

---

# 4. Revision / Revise Queue failures

## Do not create revision opportunities without anchors

- Rule: no anchor = no opportunity.
- Enforced by: revision_opportunity_ledger_v1 writer.
- Runtime consequence: route to Needs Targeting, not Revise Queue.

## Do not let Revise re-diagnose the manuscript independently

- Rule: Revise consumes revision_opportunity_ledger_v1 and accepted ledger context; it does not invent a new evaluation.
- Enforced by: workbench ingestion and TrustedPath ledger-backed flow.
- Runtime consequence: block or ignore untrusted candidate-only findings.

## Do not render generic advice as a surgical revision operation

- Rule: Revise Queue requires a locked operation type, target, evidence, and candidate text.
- Enforced by: Revise Card Contract / operation validator.
- Runtime consequence: kick vague advice to Needs Targeting.

## Do not use forbidden meta-commentary as candidate_text

- Rule: candidate_text must be actual manuscript replacement/addition/deletion content, not “consider revising...” commentary.
- Enforced by: forbidden-phrase filter.
- Runtime consequence: block opportunity from queue.

---

# 5. Benchmark-specific completeness failures

## Do not treat benchmark files as evidence

- Rule: benchmark docs are quality targets and known-answer keys, not proof that a new manuscript contains the same facts.
- Enforced by: Phase 0 manifest and Story Layer Quality Gate.
- Runtime consequence: compare shape/completeness, then verify against uploaded manuscript.

## Do not omit benchmark-required entities in benchmark runs

Examples:

- Cartel Babies must not miss Cobra, Diego, El Tomatero, Paolito/Paul, Benjamin’s family/church/school pressure, Canadian Embassy identity changes, radio-channel punishment, and transit chain.
- Froggin Noggin must not miss Maximilian, Beiana, Lacerta, Twillow, Hyla council, Dead Zone, shard dependency, and unresolved ending escalation.
- Let the River Decide must not treat Fritz and Schultz as decorative pets, must not miss William/Esmé/Nila/Anthony/Leanna, and must not flatten the river into setting.

Runtime consequence: seed_fit_gap_report_v1 or ledger_quality_report_v1 must identify the missing benchmark target.

---

# 6. Latency and runtime discipline failures

## Do not mine PR history during runtime

- Rule: PRs are raw ore, not runtime canon.
- Enforced by: Phase 0 manifest.
- Runtime consequence: load compact warmup docs only.

## Do not load stale branch notes as canon

- Rule: current canonical docs and merged/current PR files govern.
- Runtime consequence: old PR descriptions may inform offline doctrine mining only.

## Do not expand Phase 0 into a huge prompt bundle

- Rule: warmup must be compact, deterministic, and phase-specific.
- Runtime consequence: manifest selects only the needed files; no broad repo scan.

---

# Enforcement summary

| Rule class | Primary enforcement |
|---|---|
| Hard safety / sequencing | Code guardrail + regression test |
| Benchmark completeness | Benchmark docs + fit-gap report + Story Layer Quality Gate |
| Judgment doctrine | Phase 0 warmup packet |
| Historical PR lessons | Offline mining into canonical docs |
| Author-facing display | Renderer/UI sanitizer |
| Downstream authority | Artifact handoff guards |

## Bottom line

Guardrails enforce the dangerous “do nots.” Benchmarks define quality and completeness. This file tells Phase 0 what not to do and where enforcement lives.
