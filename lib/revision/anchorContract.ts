import { z } from "zod";

export const ANCHOR_CONTEXT_TARGET_CHARS = 40;

export type ProposalAnchorStatus = "created" | "ambiguous" | "missing";

export type ProposalAnchorContract = {
  start_offset: number;
  end_offset: number;
  before_context: string;
  after_context: string;
  anchor_text_normalized?: string | null;
};

export type AnchorBuildResult =
  | ({ anchor_status: "created" } & ProposalAnchorContract)
  | {
      anchor_status: "ambiguous" | "missing";
      reason: string;
    };

export const proposalAnchorSchema = z
  .object({
    start_offset: z.number().int().min(0),
    end_offset: z.number().int(),
    before_context: z.string(),
    after_context: z.string(),
    anchor_text_normalized: z.string().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.end_offset <= value.start_offset) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_offset"],
        message: "end_offset must be greater than start_offset",
      });
    }
  });

export function normalizeForAnchorSearch(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function normalizeAnchorText(text: string): string {
  return normalizeForAnchorSearch(text).replace(/\s+/g, " ").trim();
}

// Phase 2.2: CRLF-only normalization for strict extraction contract comparison.
// Must not collapse whitespace, trim, or alter prose in any way.
export function normalizeForStrictMatch(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

// Phase 2.2: Validate that source_text.slice(start_offset, end_offset) exactly
// reproduces original_text (after CRLF-only normalization). Fail-closed — throws
// on any mismatch. No fallback, no re-search, no offset mutation.
export function validateExtractionContract(
  proposal: {
    start_offset: number;
    end_offset: number;
    original_text: string;
  },
  sourceText: string,
): { extractedText: string } {
  if (!Number.isInteger(proposal.start_offset) || proposal.start_offset < 0) {
    throw new Error(
      "Extraction contract violation: start_offset must be a non-negative integer.",
    );
  }

  if (
    !Number.isInteger(proposal.end_offset) ||
    proposal.end_offset <= proposal.start_offset
  ) {
    throw new Error(
      "Extraction contract violation: end_offset must be greater than start_offset.",
    );
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

function buildNormalizedIndexMap(sourceText: string): {
  normalizedSource: string;
  normalizedIndexToRawIndex: number[];
} {
  let normalizedSource = "";
  const normalizedIndexToRawIndex: number[] = [];

  let rawIndex = 0;
  while (rawIndex < sourceText.length) {
    const char = sourceText[rawIndex];

    if (char === "\r") {
      normalizedIndexToRawIndex.push(rawIndex);
      normalizedSource += "\n";

      if (sourceText[rawIndex + 1] === "\n") {
        rawIndex += 2;
      } else {
        rawIndex += 1;
      }
      continue;
    }

    normalizedIndexToRawIndex.push(rawIndex);
    normalizedSource += char;
    rawIndex += 1;
  }

  normalizedIndexToRawIndex.push(sourceText.length);

  return {
    normalizedSource,
    normalizedIndexToRawIndex,
  };
}

export function validateAnchorAgainstSource(
  anchor: ProposalAnchorContract,
  sourceText: string,
  expectedOriginalText?: string,
): { extractedText: string } {
  proposalAnchorSchema.parse(anchor);

  const extractedText = sourceText.slice(anchor.start_offset, anchor.end_offset);

  if (extractedText.length === 0) {
    throw new Error("Anchor validation failed: extracted slice is empty.");
  }

  if (expectedOriginalText !== undefined) {
    const normalizedExpected = normalizeAnchorText(expectedOriginalText);
    if (normalizeAnchorText(extractedText) !== normalizedExpected) {
      throw new Error(
        "Anchor validation failed: source slice does not match expected original_text.",
      );
    }
  }

  const expectedBefore = sourceText.slice(
    Math.max(0, anchor.start_offset - ANCHOR_CONTEXT_TARGET_CHARS),
    anchor.start_offset,
  );
  const expectedAfter = sourceText.slice(
    anchor.end_offset,
    Math.min(sourceText.length, anchor.end_offset + ANCHOR_CONTEXT_TARGET_CHARS),
  );

  if (anchor.before_context !== expectedBefore) {
    throw new Error("Anchor validation failed: before_context is not deterministic.");
  }

  if (anchor.after_context !== expectedAfter) {
    throw new Error("Anchor validation failed: after_context is not deterministic.");
  }

  if (anchor.start_offset > 0 && anchor.before_context.length === 0) {
    throw new Error(
      "Anchor validation failed: before_context is empty where source text allows context.",
    );
  }

  if (anchor.end_offset < sourceText.length && anchor.after_context.length === 0) {
    throw new Error(
      "Anchor validation failed: after_context is empty where source text allows context.",
    );
  }

  if (anchor.anchor_text_normalized != null) {
    const normalizedExtracted = normalizeAnchorText(extractedText);
    if (normalizedExtracted !== anchor.anchor_text_normalized) {
      throw new Error(
        "Anchor validation failed: anchor_text_normalized does not match normalized extracted text.",
      );
    }
  }

  return { extractedText };
}

export function buildAnchorForSnippet(
  sourceText: string,
  snippet: string,
): AnchorBuildResult {
  const {
    normalizedSource,
    normalizedIndexToRawIndex,
  } = buildNormalizedIndexMap(sourceText);
  const normalizedSnippet = normalizeForAnchorSearch(snippet);

  if (!normalizedSnippet || normalizedSnippet.trim().length === 0) {
    return {
      anchor_status: "missing",
      reason: "original_text is empty; cannot compute deterministic anchor",
    };
  }

  const start = normalizedSource.indexOf(normalizedSnippet);
  if (start === -1) {
    return {
      anchor_status: "missing",
      reason: "original_text not found in source text",
    };
  }

  const second = normalizedSource.indexOf(
    normalizedSnippet,
    start + normalizedSnippet.length,
  );

  if (second !== -1) {
    return {
      anchor_status: "ambiguous",
      reason: "original_text appears multiple times in source text",
    };
  }

  const rawStart = normalizedIndexToRawIndex[start];
  const rawEnd = normalizedIndexToRawIndex[start + normalizedSnippet.length];

  if (
    !Number.isInteger(rawStart) ||
    !Number.isInteger(rawEnd) ||
    rawStart < 0 ||
    rawEnd <= rawStart
  ) {
    return {
      anchor_status: "missing",
      reason: "normalized-to-raw offset mapping failed",
    };
  }

  const anchor: ProposalAnchorContract = {
    start_offset: rawStart,
    end_offset: rawEnd,
    before_context: sourceText.slice(
      Math.max(0, rawStart - ANCHOR_CONTEXT_TARGET_CHARS),
      rawStart,
    ),
    after_context: sourceText.slice(
      rawEnd,
      Math.min(
        sourceText.length,
        rawEnd + ANCHOR_CONTEXT_TARGET_CHARS,
      ),
    ),
    anchor_text_normalized: normalizeAnchorText(sourceText.slice(rawStart, rawEnd)),
  };

  validateAnchorAgainstSource(anchor, sourceText, snippet);

  return {
    anchor_status: "created",
    ...anchor,
  };
}
