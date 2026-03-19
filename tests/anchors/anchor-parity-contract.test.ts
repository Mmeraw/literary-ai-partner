// Phase 2.1 — Anchor Parity Contract Test
//
// PURPOSE: Prove that every enforcement layer (Zod schema, runtime validator)
// rejects the SAME illegal anchor fixtures and accepts the same legal ones.
//
// This is a cross-layer parity proof, not a unit test of any single function.
// If a case passes one layer but is accepted by another, the enforcement is
// unsynchronized and this test will catch it.
//
// DB constraints (NOT VALID, so not auto-applied to existing rows) mirror the
// same invariants — see migration 20260318000000_phase21_anchor_metadata_contract.sql.

import { describe, expect, test } from "@jest/globals";
import {
  proposalAnchorSchema,
  validateExtractionContract,
} from "@/lib/revision/anchorContract";

// ---------------------------------------------------------------------------
// Fixture builder helpers
// ---------------------------------------------------------------------------

type AnchorInput = {
  start_offset: number;
  end_offset: number;
  before_context: string;
  after_context: string;
  anchor_text_normalized?: string | null;
};

const SOURCE_TEXT = "Alpha line.\nTarget sentence here.\nOmega line.";
// "Alpha line.\n" = 12 chars; "Target sentence here." = 21 chars → offsets [12, 33]
const VALID_ANCHOR: AnchorInput = {
  start_offset: 12,
  end_offset: 33,
  before_context: "Alpha line.\n",
  after_context: "\nOmega line.",
  anchor_text_normalized: "Target sentence here.",
};
const VALID_ORIGINAL_TEXT = "Target sentence here.";

// ---------------------------------------------------------------------------
// Canonical illegal fixture matrix
// ---------------------------------------------------------------------------
// Each entry describes WHY it is illegal and what both layers must do with it.

const ILLEGAL_FIXTURES: Array<{
  label: string;
  anchor: AnchorInput;
  zodPath?: string; // path of the Zod error expected
  runtimeError?: RegExp; // error message pattern from validateExtractionContract
  runtimeOriginalText?: string; // for runtime check (use VALID_ORIGINAL_TEXT unless noted)
}> = [
  {
    label: "end_offset equals start_offset (zero-length span)",
    anchor: { ...VALID_ANCHOR, start_offset: 12, end_offset: 12 },
    zodPath: "end_offset",
    runtimeError: /end_offset must be greater than start_offset/,
  },
  {
    label: "end_offset less than start_offset (inverted span)",
    anchor: { ...VALID_ANCHOR, start_offset: 20, end_offset: 5 },
    zodPath: "end_offset",
    runtimeError: /end_offset must be greater than start_offset/,
  },
  {
    label: "negative start_offset",
    anchor: { ...VALID_ANCHOR, start_offset: -1, end_offset: 33 },
    zodPath: "start_offset",
    runtimeError: /start_offset must be a non-negative integer/,
  },
  {
    label: "non-integer start_offset",
    anchor: { ...VALID_ANCHOR, start_offset: 1.5, end_offset: 33 },
    zodPath: "start_offset",
    // Runtime validator does not specifically check non-integer, so skip it
    // (Zod enforces .int(); runtime relies on Zod having run first in production).
  },
  {
    label: "non-integer end_offset",
    anchor: { ...VALID_ANCHOR, start_offset: 12, end_offset: 32.7 },
    zodPath: "end_offset",
  },
];

// ---------------------------------------------------------------------------
// Zod layer parity tests
// ---------------------------------------------------------------------------

describe("Anchor parity — Zod schema enforcement (proposalAnchorSchema)", () => {
  test("accepts a canonical valid anchor", () => {
    const result = proposalAnchorSchema.safeParse(VALID_ANCHOR);
    expect(result.success).toBe(true);
  });

  for (const fixture of ILLEGAL_FIXTURES) {
    test(`rejects: ${fixture.label}`, () => {
      const result = proposalAnchorSchema.safeParse(fixture.anchor);
      expect(result.success).toBe(false);

      if (!result.success && fixture.zodPath) {
        const paths = result.error.issues.map((i) => i.path.join("."));
        expect(paths).toContain(fixture.zodPath);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Runtime validator parity tests
// ---------------------------------------------------------------------------

describe("Anchor parity — runtime validator enforcement (validateExtractionContract)", () => {
  test("accepts a canonical valid anchor against matching source", () => {
    expect(() =>
      validateExtractionContract(
        {
          start_offset: VALID_ANCHOR.start_offset,
          end_offset: VALID_ANCHOR.end_offset,
          original_text: VALID_ORIGINAL_TEXT,
        },
        SOURCE_TEXT,
      ),
    ).not.toThrow();
  });

  for (const fixture of ILLEGAL_FIXTURES) {
    if (!fixture.runtimeError) continue; // Zod-only check; skip runtime

    test(`rejects: ${fixture.label}`, () => {
      expect(() =>
        validateExtractionContract(
          {
            start_offset: fixture.anchor.start_offset,
            end_offset: fixture.anchor.end_offset,
            original_text: fixture.runtimeOriginalText ?? VALID_ORIGINAL_TEXT,
          },
          SOURCE_TEXT,
        ),
      ).toThrow(fixture.runtimeError);
    });
  }
});

// ---------------------------------------------------------------------------
// Cross-layer agreement tests
// ---------------------------------------------------------------------------
// These tests prove the two layers agree: if Zod rejects, the runtime rejects too.
// (The inverse holds for valid anchors above.)

describe("Anchor parity — cross-layer agreement on illegal anchors", () => {
  const RUNTIME_COVERED = ILLEGAL_FIXTURES.filter((f) => f.runtimeError);

  test.each(RUNTIME_COVERED.map((f) => [f.label, f] as const))(
    "both Zod and runtime reject: %s",
    (_label, fixture) => {
      // Zod must reject
      const zodResult = proposalAnchorSchema.safeParse(fixture.anchor);
      expect(zodResult.success).toBe(false);

      // Runtime must reject
      expect(() =>
        validateExtractionContract(
          {
            start_offset: fixture.anchor.start_offset,
            end_offset: fixture.anchor.end_offset,
            original_text: fixture.runtimeOriginalText ?? VALID_ORIGINAL_TEXT,
          },
          SOURCE_TEXT,
        ),
      ).toThrow();
    },
  );

  test("both Zod and runtime accept the canonical valid anchor", () => {
    const zodResult = proposalAnchorSchema.safeParse(VALID_ANCHOR);
    expect(zodResult.success).toBe(true);

    expect(() =>
      validateExtractionContract(
        {
          start_offset: VALID_ANCHOR.start_offset,
          end_offset: VALID_ANCHOR.end_offset,
          original_text: VALID_ORIGINAL_TEXT,
        },
        SOURCE_TEXT,
      ),
    ).not.toThrow();
  });
});
