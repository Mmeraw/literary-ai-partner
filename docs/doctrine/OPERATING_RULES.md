# Operating Rule: Revision Path Authority

> **No model output may modify manuscript text unless it has passed through the governed revision orchestrator.**

## Scope

This rule applies to ALL revision activity, including:

- Direct rewrite calls
- Assistant-generated scene replacements
- Patch proposals
- WAVE execution

## Enforcement

All revision activity must pass through these gates in order:

1. **Pass Evaluation** (13 criteria + WAVE system)
2. **Sufficiency Gate** (if scene already passes function/theme/tone/structure, return NO_CHANGE_REQUIRED)
3. **Wave Eligibility** (fail-closed; any rejected wave blocks all waves)
4. **Destruction Guards** (max 10% removal; protected spans inviolable)
5. **Patch Validation** (no layer leakage, no environmental agency, no moral interpretation)
6. **Governance Logging** (every decision persisted to governance_logs)

## Invariants

These must ALWAYS hold true:

- A perfect scene produces **NO_CHANGE_REQUIRED**
- A vignette can **never** be escalated
- A human scene can **never** gain Realm voice
- Diagnostic mode can **never** output rewritten prose

## Bypass

Any bypass invalidates the output. No raw model calls may exist outside the orchestrator path.

---

# Operating Rule: Recommendation Integrity & Prose Quality

> **No malformed, garbled, or generic recommendation may reach the author. Every LLM-generated text must pass a prose-quality gate before advancing to the next pipeline stage.**

## Scope

This rule applies to ALL author-facing generated content, including:

- Pass 1 extraction output (story layers, evidence mapping)
- Pass 2 craft diagnosis output (recommendations, rationale)
- Pass 3 synthesis output (executive summary, criteria narratives, final recommendations)
- Download pipeline output (PDF, DOCX, TXT)

## Enforcement

Every LLM output point must pass deterministic prose-quality gates:

1. **Handoff Gate (S06b)** — validates Pass 1/2 output before synthesis:
   - Sentence completeness (subject + verb + terminal punctuation)
   - No scaffold residue (`[PLACEHOLDER]`, `TODO:`, `<insert>`)
   - No broken modal phrases (`"which More…"`, `"can long stretches…"`)
   - No generic workshop language without evidence anchor
   - Evidence anchors present for every recommendation

2. **Recommendation Integrity Gate (S07)** — validates Pass 3 output before normalization:
   - No FAIL-tier recommendations reach persistence
   - Every recommendation has complete sentences, evidence anchor, actionable specificity
   - Malformed/garbled/generic recommendations are quarantined

3. **Download Pipeline (S11b)** — validates before author receives file:
   - Read-time sanitizer cleans editorial text only
   - Parity gate validates post-sanitization integrity
   - Evidence ownership preserved (manuscript quotations untouched)

## Invariants

These must ALWAYS hold true:

- A malformed recommendation **never** reaches the author
- Manuscript quotations are **never** sanitized, rewritten, or mutated
- Handoff cannot feed garbage to synthesis
- A failed prose-quality gate produces **quarantine**, not silent pass-through
- Gates that check only structure or length are **insufficient** — sentence completeness and scaffold-residue detection are required

## Self-Correction Policy (PR 3)

When gates fail:

1. **Quarantine** — bad content is isolated, not persisted or forwarded
2. **Retry once** — with explicit failure reason provided to the LLM for targeted correction
3. **Fail closed** — if retry fails, no partial success is reported as final
4. **Admin-visible failure code** — machine-readable failure reason logged
5. **User-safe message** — human-readable explanation if failure reaches user boundary

---

# Operating Rule: Evidence Ownership Boundary

> **Manuscript quotations are author-owned evidence and must never be altered by any pipeline stage.**

## Scope

This rule applies to ALL pipeline stages that process manuscript content:

- `anchor_snippet` — direct manuscript quotation proving where a finding originates
- `evidence_snippets[*].snippet` — manuscript excerpts supporting craft diagnosis
- Any other field containing verbatim author text

## Enforcement

- Read-time sanitizer (`downloadReadTimeSanitizer.ts`) explicitly skips author-owned fields
- No regex replacement, pattern cleaning, or text normalization may touch manuscript content
- Only RG-generated editorial text (summaries, rationale, recommendations, quick wins, strategic revisions) may be sanitized

## Invariants

These must ALWAYS hold true:

- `anchor_snippet` is byte-for-byte identical from persistence through all render paths
- `evidence_snippets[*].snippet` is byte-for-byte identical from persistence through all render paths
- If an author literally wrote "Studies are mixed on the success of..." that quote must remain exactly as written
- Altering evidence is a governance violation, not a bug

---

*This is the institutional authority for RevisionGrade's evaluation and revision pipelines. Changing this document requires a migration plan and version bump.*
