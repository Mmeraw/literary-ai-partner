## Summary
This PR pivots Story Ledger and evaluation preflight generation from a reducer-first architecture to an **LLM-first Phase 0.5 semantic artifact generation** architecture.

The current reducer-first path caused semantic category contamination: symbolic forces, objects, themes, and craft notes could be routed through a character-led extraction/reducer pipeline before being projected into Story Ledger layers.

This PR changes the governing model:

> Phase 0.5 creates the semantic artifacts.
> Phase 1A verifies them.
> Pass 3A normalizes them.
> Phase 2/3 consume only verified artifacts.
Reducers remain in the system, but they are demoted from **primary semantic authors** to **verifiers, auditors, and normalizers**.

---

## Why this change is required
The Chapter 3 incident showed that the current Story Ledger path can fail in an architecturally predictable way:

- narrator split into multiple identities
- river treated as character-like identity
- truck/object routed as character
- environmental reciprocity / ancestral memory treated as entity instead of theme/pressure
- `Time pressure / lack of ticking clock` treated as Story Ledger entity
- internal chunk labels leaked into author-facing output
- blocked or degraded artifacts reached downstream review/acceptance paths before PR #891 guardrails

PR #891 closes the fail-closed safety holes.
This PR addresses the deeper cause: Story Ledger generation should begin with whole-text LLM semantic understanding, not character-led reducer projection.

---

## Required architecture

### Phase 0 — Doctrine / template warmup
Load the materials needed for semantic artifact generation:

- Story Ledger template
- Evaluation template
- RevisionGrade editorial doctrine
- benchmark / gold-standard examples
- forbidden mistakes
- short-form vs long-form rules
- JSON schema requirements
- fail-closed governance rules

Output:

- `phase0_warmup_packet_v1`

---

### Phase 0.5A — Whole-text LLM Story Ledger draft
The LLM reads the manuscript/chapter directly and generates the Story Ledger as a semantic artifact.

Input:

- manuscript/chapter text
- `phase0_warmup_packet_v1`
- 9-layer Story Ledger schema
- forbidden category mistakes
- short-form / long-form mode rules

Output:

- `phase0_5a_story_ledger_draft_v1`

Required entity separation:

- human / animal characters
- POV owners
- symbolic or environmental forces
- objects / evidence markers
- locations / world state
- relationships
- themes / pressures
- threat / ending states
- craft diagnosis concepts, kept out of story identity layers

Explicit rule:

- Do **not** represent non-character threat forces as character candidates.
- Do **not** route objects, themes, symbolic systems, or craft notes through Canonical Identity or Cast.

---

### Phase 0.5B — Whole-text LLM Evaluation Blueprint
The LLM generates an early evaluation blueprint from the manuscript and the Story Ledger draft.

Input:

- manuscript/chapter text
- `phase0_5a_story_ledger_draft_v1`
- evaluation template
- 13-criteria doctrine
- short-form / long-form mode rules

Output:

- `phase0_5b_evaluation_blueprint_v1`

This is not necessarily the final evaluation report. It is a semantic/evidence blueprint for downstream diagnosis.

Required content:

- criterion-level evidence map
- likely strengths
- likely risks
- evidence anchors
- likely revision opportunities
- uncertainty flags
- short-form constraints where applicable

---

### Phase 1A — Chunk verification / evidence audit
Chunking begins here as verification, not creation.

Phase 1A verifies claims made by Phase 0.5A and Phase 0.5B against manuscript text.

For each claim, Phase 1A must mark:

- `verified`
- `contradicted`
- `unsupported`
- `missing`
- `corrected`
- `needs_operator_review`

Output:

- `phase1a_story_ledger_verification_v1`
- `phase1a_evaluation_blueprint_verification_v1`

Phase 1A must not invent a new Story Ledger from scratch when Phase 0.5 artifacts exist. It should audit, correct, and enrich them.

---

### Pass 3A — Normalized verified handoff
Pass 3A reconciles the LLM semantic draft and the chunk verification audit.

Output:

- `verified_story_evaluation_handoff_v1`

This verified handoff becomes the only artifact eligible to feed Phase 2/3 diagnosis, WAVE eligibility, report generation, Revise Queue, or accepted-ledger creation.

Required normalization:

- merge narrator aliases
- merge duplicate symbolic forces
- separate objects from characters
- separate themes/pressures from cast
- remove craft-note-as-entity pollution
- strip internal chunk labels from author-facing output
- preserve evidence anchors
- preserve uncertainty flags

---

### Phase 2/3 — Consume verified artifacts only
Phase 2 and Phase 3 may use:

- `verified_story_evaluation_handoff_v1`
- verified manuscript evidence
- verified criterion evidence maps

They must not treat raw Phase 0.5 drafts as final truth.

Raw drafts are advisory until verified.

---

## Governance rules
Unknown, malformed, degraded, or contradictory semantic verdicts must remain fail-closed.

The system must block downstream readiness when:

- `phase0_5a_story_ledger_draft_v1` is missing or malformed
- `phase0_5b_evaluation_blueprint_v1` is missing or malformed
- Phase 1A verification fails
- Pass 3A normalization fails
- semantic category leakage is detected
- quality verdict metadata is null, malformed, or unknown
- evidence coverage is insufficient for the requested evaluation mode

No author-facing Review Gate may open for blocked semantic states.

No `accepted_story_ledger_v1` may be written from:

- blocked artifacts
- repair-required artifacts
- unverified Phase 0.5 drafts
- failed reducer/verification state
- unknown quality verdicts

---

## Short-form behavior
For submissions under 25,000 words:

- Phase 0.5A should use the full text directly.
- Phase 0.5B should use the full text directly.
- Chunking should verify, not create, the semantic artifacts.
- The author-facing Story Ledger gate should remain disabled unless explicitly required by product mode.
- Short-form evaluations must not apply full-novel ending-accountability logic.

---

## Long-form behavior
For long manuscripts:

- Phase 0.5A may use whole-manuscript context where feasible.
- If whole-text context is not feasible, use staged LLM semantic passes to create a provisional master Story Ledger draft.
- Chunking then verifies and repairs the draft.
- The reducer must never be the primary Story Ledger author.
- The final downstream artifact must be the verified handoff, not raw chunk fragments.

---

## Permanent regression fixture
Use Chapter 3 / `fe152c58` as the permanent fixture.

The system must fail if:

- the narrator is split into multiple identities
- `The narrator`, `I_narrator`, and first-person narrator are treated as separate people
- the river is classified as a human character
- the river is duplicated as `The river` and `The_river`
- the missing camper truck appears in Canonical Identity or Cast
- environmental reciprocity / ancestral memory appears as a character identity
- predator system appears as cast instead of ecological pressure
- `Time pressure / lack of ticking clock` appears in any story-entity layer
- internal `chunk` labels appear in author-facing output
- full-novel ending-accountability rules are applied to a short-form chapter excerpt

Expected positive output:

- first-person narrator detected as primary POV owner
- one narrator identity only
- one river symbolic/environmental force
- missing camper truck classified as object/evidence marker
- environmental reciprocity / ancestral memory classified as theme/pressure
- predator system classified as ecological pressure
- Robert classified as guide / pressure speaker / cultural interpreter
- Cliff classified as major companion / emotional anchor
- no craft-note-as-entity leakage
- no chunk labels in author-facing output
- quality verdict reviewable only after semantic checks pass

---

## Acceptance criteria

- Phase 0.5A produces `phase0_5a_story_ledger_draft_v1`.
- Phase 0.5B produces `phase0_5b_evaluation_blueprint_v1`.
- Phase 1A verifies Phase 0.5 claims instead of creating the Story Ledger from scratch.
- Pass 3A produces `verified_story_evaluation_handoff_v1`.
- Phase 2/3 consume verified artifacts only.
- The character-led reducer is no longer the primary Story Ledger generator.
- Non-character threat forces are not represented as character candidates.
- Unknown or malformed semantic quality states fail closed.
- Chapter 3 fixture passes the positive semantic-generation acceptance criteria.
- Existing PR #891 fail-closed protections remain intact.

---

## Non-goals
This PR does not remove reducers.

Reducers remain useful for:

- evidence auditing
- contradiction detection
- alias normalization
- identity merging
- category validation
- chunk-level coverage checks
- downstream safety enforcement

This PR changes the reducer’s role from semantic author to semantic verifier.

---

## Test plan
Add tests for:

- whole-text Phase 0.5A Story Ledger generation
- whole-text Phase 0.5B Evaluation Blueprint generation
- Phase 1A claim verification statuses
- Pass 3A verified handoff creation
- blocked handoff on malformed Phase 0.5 artifacts
- blocked handoff on category leakage
- Chapter 3 positive fixture from manuscript text, not hand-built ledger inputs
- no accepted-ledger write from unverified Phase 0.5 drafts
- no author-facing Review Gate for blocked semantic states

Required focused test command:

`npx jest --runInBand __tests__/lib/evaluation/phase05/ __tests__/lib/evaluation/phase1a/ __tests__/evaluation/reviewGate.phaseV2Handoff.test.ts __tests__/evaluation/storyLedgerApprovalNormalizer.test.ts`

---

## Merge framing
This is the architecture cure after PR #891.

PR #891 closes the trap door.
This PR changes what walks toward the trap door.

The goal is not to make the reducer smarter at inventing Story Ledgers.
The goal is to let the LLM create semantically coherent artifacts first, then make the reducer prove, normalize, and protect them.
