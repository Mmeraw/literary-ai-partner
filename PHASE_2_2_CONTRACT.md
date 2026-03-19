# Phase 2.2 — Proposal Extraction Contract

**Status:** COMPLETED, VERIFIED  
**Phase 2.1 Gate:** DB verification passed (2026-03-18, 6/6 gates green)  
**Phase 2.2 Closed:** 2026-03-19, 21/21 tests green  
**Owner:** Mike Meraw

---

## Authoritative Anchor Contract

The active anchor/extraction contract is **canonical raw-offset anchoring**: each proposal must persist `start_offset` (integer, 0-based inclusive), `end_offset` (integer, 0-based exclusive), `before_context` (text, ~40 chars before anchor), `after_context` (text, ~40 chars after anchor), `anchor_text_normalized` (text, normalized extracted text), and `anchor_version` (text, default `'v1'`). Deterministic extraction is defined as `source_text.slice(start_offset, end_offset)` must exactly reproduce `original_text` after CRLF→LF normalization; normalization is permitted only for validation/comparison, never as a substitute extraction source; apply must remain fail-closed with no fallback string-search and no document re-search for anchored proposals; the legacy text-search path in `applySingleReplacementStrict()` exists only for pre-anchor proposals that lack offsets.

### Canonical Field Names (DB + Code)

Verified against live code in the Codespace (2026-03-19):

| Field | Type | DB Migration | TS Type | Purpose |
|-------|------|-------------|---------|---------|
| `start_offset` | `integer` | `20260318` | `ChangeProposal.start_offset: number` | 0-based inclusive start offset into source text |
| `end_offset` | `integer` | `20260318` | `ChangeProposal.end_offset: number` | 0-based exclusive end offset into source text |
| `before_context` | `text NOT NULL DEFAULT ''` | `20260318` | `ChangeProposal.before_context: string` | ~40 chars before the anchor for context verification |
| `after_context` | `text NOT NULL DEFAULT ''` | `20260318` | `ChangeProposal.after_context: string` | ~40 chars after the anchor for context verification |
| `anchor_text_normalized` | `text` | `20260318` | `ChangeProposal.anchor_text_normalized: string \| null` | Normalized form of extracted text |
| `anchor_version` | `text NOT NULL DEFAULT 'v1'` | `20260318` | (implied) | Schema version for anchor format |
| `original_text` | `text` | (original schema) | `ChangeProposal.original_text: string` | The exact text at the anchor position |

### Legacy Fields (DB Compatibility Only)

These columns were added by migration `20260317` and remain in the DB for backfill compatibility. They are **NOT** authoritative for any new code.

| Legacy field | Added by | Status |
|-------------|----------|--------|
| `anchor_start` | Migration `20260317` | Legacy — backfill/compatibility only |
| `anchor_end` | Migration `20260317` | Legacy — backfill/compatibility only |
| `anchor_context` | Migration `20260317` | Legacy — backfill/compatibility only |

The Phase 2.1 migration (`20260318`) added the canonical names and backfilled from the legacy columns (`start_offset = coalesce(start_offset, anchor_start)`). The mapper in `proposals.ts` reads `row.start_offset ?? row.anchor_start` as a DB compatibility fallback — legacy fields are not authoritative for new code.

### Errata

The initial version of this document (committed 2026-03-19, commit `265394a`) incorrectly listed `anchor_start`, `anchor_end`, and `anchor_context` as the canonical names. This was based on an analysis of the committed `apply.ts` on GitHub `main`, which at that time still contained the pre-Phase-2.1 code. The Codespace had uncommitted Phase 2.1 changes (migration `20260318` + updated `types.ts`) that renamed the fields. The code is authoritative; the document was stale. Corrected in this version.

---

## Contract Rules

1. **Deterministic extraction:** `source_text.slice(start_offset, end_offset)` must exactly reproduce `original_text` (after `normalizeForStrictMatch`)
2. **Normalization scope:** CRLF→LF only, for comparison/validation — never as substitute source
3. **Fail-closed:** If slice doesn't match, throw — no retry, no search, no fallback
4. **No document re-search:** Anchored proposals use offsets only; text search is legacy-only
5. **Context fields:** `before_context` and `after_context` (~40 chars each) provide surrounding context for secondary verification
6. **Sort order:** Proposals applied in reverse `start_offset` order (highest first) to preserve offset validity

---

## Implementation Summary (Phase 2.2 Delivery)

### Files Changed

| File | Change |
|------|--------|
| `lib/revision/anchorContract.ts` | Added `normalizeForStrictMatch()` (exported, CRLF-only) + `validateExtractionContract()` (Phase 2.2 gate) |
| `lib/revision/apply.ts` | Removed local private `normalizeForStrictMatch`; imports from `anchorContract`. Uses `start_offset`/`end_offset` for anchored path |
| `lib/revision/proposals.ts` | Imports + calls `validateExtractionContract` in `normalizeProposalCandidates` |
| `lib/revision/proposalSynthesis.ts` | Imports + calls `validateExtractionContract` in `toProposalInputs` |
| `lib/revision/types.ts` | `ChangeProposal` type updated to canonical field names |
| `lib/revision/sessions.ts` | Updated for new field names |
| `scripts/revision-stage2-smoke.mjs` | Updated for new field names |

### Tests

- `tests/anchors/extraction-contract.test.ts` — 17 tests, all passing
- `tests/anchors/anchor-validation.test.ts` — 4 tests, all passing
- **Total: 21/21 green**

### Contract Enforcement

`validateExtractionContract` is a hard gate at proposal creation time — in both `normalizeProposalCandidates` (evaluator-originated proposals) and `toProposalInputs` (synthesis-originated proposals). Any proposal whose slice doesn't match `original_text` throws before it can be persisted. No fallback. No re-search. No whitespace collapse. Fail-closed.

---

## Source Evidence

| Artifact | Location | What it proves |
|----------|----------|----------------|
| `lib/revision/types.ts` (`ChangeProposal`) | Codespace live | Type has `start_offset`, `end_offset`, `before_context`, `after_context`, `anchor_text_normalized` |
| `lib/revision/apply.ts` lines 27-30, 50-51 | Codespace live | Runtime uses `proposal.start_offset`, `proposal.end_offset` |
| `lib/revision/anchorContract.ts` (`ProposalAnchorContract`) | Codespace live | Contract type uses `start_offset`, `end_offset`, `before_context`, `after_context` |
| `supabase/migrations/20260318*` | Codespace live | Canonical migration adds `start_offset`, `end_offset`, `before_context`, `after_context`, `anchor_text_normalized`, `anchor_version` |
| `supabase/migrations/20260317*` | Codespace live | Legacy migration adds `anchor_start`, `anchor_end`, `anchor_context` (compatibility only) |
| Test run output | Codespace `npm test` | 21/21 passing, 2 suites, 3.005s |
