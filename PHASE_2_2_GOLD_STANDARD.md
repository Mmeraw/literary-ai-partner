# Phase 2.2 — Gold Standard & Grading Rubric

**Purpose:** Target shape and grading rubric for Phase 2.2 implementation.  
**Status:** COMPLETED — Copilot delivery graded PASS (2026-03-19).  
**Companion:** See `PHASE_2_2_CONTRACT.md` for the authoritative field-name mapping and contract statement.

---

## Canonical Field Names

**These are the ONLY authoritative field names** (verified against live code, migrations, and types):

| Canonical (code + DB) | Legacy (DB only, compatibility) |
|-----------------------|-------------------------------|
| `start_offset` | `anchor_start` |
| `end_offset` | `anchor_end` |
| `before_context` | `anchor_context` (single field) |
| `after_context` | (no legacy equivalent) |
| `anchor_text_normalized` | (no legacy equivalent) |
| `anchor_version` | (no legacy equivalent) |

Sources: `lib/revision/types.ts` (`ChangeProposal`), `lib/revision/anchorContract.ts` (`ProposalAnchorContract`), `supabase/migrations/20260318*`.

---

## 1. Core Behavior

The implementation does exactly this:

```typescript
const extracted = sourceText.slice(proposal.start_offset, proposal.end_offset);
const normalizedExtracted = normalizeForStrictMatch(extracted);
const normalizedOriginal = normalizeForStrictMatch(proposal.original_text);

if (normalizedExtracted !== normalizedOriginal) {
  throw new Error("Extraction contract violation: source slice does not match original_text.");
}
```

It does **NOT**: search the document again, repair bad anchors, use fuzzy matching, use semantic similarity, fall back to `indexOf`, or mutate offsets.

---

## 2. Files Changed

| File | Change |
|------|--------|
| `lib/revision/anchorContract.ts` | `normalizeForStrictMatch()` (exported, CRLF-only) + `validateExtractionContract()` (Phase 2.2 gate) |
| `lib/revision/apply.ts` | Removed local `normalizeForStrictMatch`; imports from `anchorContract`. Anchored path uses `start_offset`/`end_offset` |
| `lib/revision/proposals.ts` | Calls `validateExtractionContract` in `normalizeProposalCandidates` |
| `lib/revision/proposalSynthesis.ts` | Calls `validateExtractionContract` in `toProposalInputs` |
| `tests/anchors/extraction-contract.test.ts` | 17 new tests |

---

## 3. The Core Function

```typescript
export function validateExtractionContract(
  proposal: {
    start_offset: number;
    end_offset: number;
    original_text: string;
  },
  sourceText: string,
): { extractedText: string } {
  if (!Number.isInteger(proposal.start_offset) || proposal.start_offset < 0) {
    throw new Error("Extraction contract violation: start_offset must be a non-negative integer.");
  }

  if (!Number.isInteger(proposal.end_offset) || proposal.end_offset <= proposal.start_offset) {
    throw new Error("Extraction contract violation: end_offset must be greater than start_offset.");
  }

  const extractedText = sourceText.slice(proposal.start_offset, proposal.end_offset);

  if (extractedText.length === 0) {
    throw new Error("Extraction contract violation: extracted slice is empty.");
  }

  const normalizedExtracted = normalizeForStrictMatch(extractedText);
  const normalizedOriginal = normalizeForStrictMatch(proposal.original_text);

  if (normalizedExtracted !== normalizedOriginal) {
    throw new Error(
      "Extraction contract violation: source slice does not match original_text.",
    );
  }

  return { extractedText };
}
```

---

## 4. `normalizeForStrictMatch()` — Minimal

```typescript
export function normalizeForStrictMatch(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}
```

Does **NOT**: collapse whitespace, trim, remove punctuation, lowercase text, or alter prose.

---

## 5. Required Tests (All Present)

| ID | Test | Status |
|----|------|--------|
| A | Exact raw slice match | PASS |
| B | CRLF normalization match | PASS |
| C | Off-by-one start failure | PASS |
| D | Off-by-one end failure | PASS |
| E | Empty slice failure | PASS |
| F | No fallback — mismatch throws even when text exists elsewhere | PASS |
| G | Punctuation boundary case | PASS |
| H | Document start/end boundary | PASS |
| + | Guard: negative start_offset | PASS |
| + | Guard: end_offset <= start_offset | PASS |
| + | normalizeForStrictMatch isolation (5 tests): CRLF, bare CR, no whitespace collapse, no trim, no case/punctuation mutation | PASS |

**Total: 17 extraction-contract tests + 4 anchor-validation tests = 21/21 green**

---

## 6. Gold-Standard Test Shape

```typescript
import { describe, expect, test } from "@jest/globals";
import { validateExtractionContract, normalizeForStrictMatch } from "@/lib/revision/anchorContract";

describe("Phase 2.2 extraction contract", () => {
  test("passes when raw slice matches original_text", () => {
    const sourceText = "Alpha line.\nTarget sentence here.\nOmega line.";
    const proposal = {
      start_offset: 12,
      end_offset: 33,
      original_text: "Target sentence here.",
    };
    expect(() => validateExtractionContract(proposal, sourceText)).not.toThrow();
  });

  test("passes with CRLF normalization only", () => {
    const sourceText = "Alpha line.\r\nTarget sentence here.\r\nOmega line.";
    const proposal = {
      start_offset: 13,
      end_offset: 34,
      original_text: "Target sentence here.",
    };
    const result = validateExtractionContract(proposal, sourceText);
    expect(normalizeForStrictMatch(result.extractedText)).toBe(
      normalizeForStrictMatch(proposal.original_text),
    );
  });

  test("fails on off-by-one start offset", () => {
    const sourceText = "Alpha line.\nTarget sentence here.\nOmega line.";
    const proposal = {
      start_offset: 11,
      end_offset: 33,
      original_text: "Target sentence here.",
    };
    expect(() => validateExtractionContract(proposal, sourceText)).toThrow(
      /does not match original_text/,
    );
  });

  test("fails on off-by-one end offset", () => {
    const sourceText = "Alpha line.\nTarget sentence here.\nOmega line.";
    const proposal = {
      start_offset: 12,
      end_offset: 32,
      original_text: "Target sentence here.",
    };
    expect(() => validateExtractionContract(proposal, sourceText)).toThrow(
      /does not match original_text/,
    );
  });

  test("fails when extracted slice is empty", () => {
    const sourceText = "Hello";
    const proposal = {
      start_offset: 2,
      end_offset: 2,
      original_text: "",
    };
    expect(() => validateExtractionContract(proposal, sourceText)).toThrow();
  });
});
```

---

## 7. Pass/Fail Criteria

### PASSED:
- [x] Uses `sourceText.slice(start_offset, end_offset)`
- [x] Compares to `original_text`
- [x] Normalization is CRLF→LF only
- [x] No re-search logic
- [x] No fallback matching
- [x] Tests cover off-by-one and CRLF
- [x] Errors are explicit and fail-closed
- [x] All docs and code agree on field names

### One-liner standard:

> Phase 2.2 passes only if anchored extraction is a pure raw-slice contract with CRLF-only normalization for comparison and zero fallback behavior.

**Verdict: PASS**

---

## Errata Log

| Date | Section | Original | Corrected | Reason |
|------|---------|----------|-----------|--------|
| 2026-03-19 | All | Used `anchor_start`/`anchor_end`/`anchor_context` throughout | Corrected to `start_offset`/`end_offset`/`before_context`/`after_context` | Initial version was written against committed `main` which had pre-Phase-2.1 code. Codespace had uncommitted migration `20260318` renaming fields. Code is authoritative. |
| 2026-03-19 | Test A | `anchor_end: 32` | `end_offset: 33` | `slice(12, 32)` misses period. Verified via Python. |
| 2026-03-19 | Test C | `anchor_end: 32` | `end_offset: 33` | Consistency with corrected Test A |
| 2026-03-19 | Test D | Missing | Added | Was listed as required but had no test body in original |
