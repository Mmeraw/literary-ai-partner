import {
  ANCHOR_CONTEXT_TARGET_CHARS,
  normalizeForStrictMatch,
  validateExtractionContract,
} from "./anchorContract";
import type { ChangeProposal } from "./types";

export type ApplyBatchResult = {
  output_text: string;
  applied_count: number;
};

function isActionableProposal(
  proposal: ChangeProposal,
): proposal is ChangeProposal & { decision: "accepted" | "modified" } {
  return proposal.decision === "accepted" || proposal.decision === "modified";
}

function getReplacementText(proposal: ChangeProposal): string {
  return proposal.decision === "modified"
    ? (proposal.modified_text ?? proposal.proposed_text)
    : proposal.proposed_text;
}

function getValidatedRange(
  proposal: ChangeProposal,
  sourceTextLength: number,
): { start: number; end: number } {
  const start = proposal.start_offset;
  const end = proposal.end_offset;

  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    throw new Error(
      `Proposal ${proposal.id} missing valid anchor offsets; apply requires deterministic anchored coordinates.`,
    );
  }

  if (start < 0 || end <= start) {
    throw new Error(
      `Proposal ${proposal.id} missing valid anchor offsets; apply requires deterministic anchored coordinates.`,
    );
  }

  if (end > sourceTextLength) {
    throw new Error(`Proposal ${proposal.id} anchor range exceeds source length.`);
  }

  return { start, end };
}

export function sortProposalsForApply(proposals: ChangeProposal[]): ChangeProposal[] {
  return [...proposals].sort((a, b) => {
    const aStart = a.start_offset ?? -1;
    const bStart = b.start_offset ?? -1;
    if (bStart !== aStart) {
      return bStart - aStart;
    }

    const aEnd = a.end_offset ?? -1;
    const bEnd = b.end_offset ?? -1;
    if (bEnd !== aEnd) {
      return bEnd - aEnd;
    }

    return String(a.id).localeCompare(String(b.id));
  });
}

export function assertNoOverlapsOrDuplicateRanges(proposals: ChangeProposal[]): void {
  const ascending = [...proposals].sort((a, b) => {
    const aStart = a.start_offset ?? -1;
    const bStart = b.start_offset ?? -1;
    if (aStart !== bStart) {
      return aStart - bStart;
    }

    const aEnd = a.end_offset ?? -1;
    const bEnd = b.end_offset ?? -1;
    if (aEnd !== bEnd) {
      return aEnd - bEnd;
    }

    return String(a.id).localeCompare(String(b.id));
  });

  for (let i = 1; i < ascending.length; i += 1) {
    const prev = ascending[i - 1];
    const curr = ascending[i];

    const prevStart = prev.start_offset as number;
    const prevEnd = prev.end_offset as number;
    const currStart = curr.start_offset as number;
    const currEnd = curr.end_offset as number;

    if (currStart === prevStart && currEnd === prevEnd) {
      throw new Error(
        `Duplicate proposal range detected: [${currStart}, ${currEnd})`,
      );
    }

    if (currStart < prevEnd) {
      throw new Error(
        `Overlapping proposals detected: [${prevStart}, ${prevEnd}) overlaps [${currStart}, ${currEnd})`,
      );
    }
  }
}

function validateProposalAgainstSource(
  sourceText: string,
  proposal: ChangeProposal,
): { start: number; end: number } {
  const { start, end } = getValidatedRange(proposal, sourceText.length);

  validateExtractionContract(
    {
      start_offset: start,
      end_offset: end,
      original_text: proposal.original_text,
    },
    sourceText,
  );

  const expectedBefore = sourceText.slice(
    Math.max(0, start - ANCHOR_CONTEXT_TARGET_CHARS),
    start,
  );
  const expectedAfter = sourceText.slice(
    end,
    Math.min(sourceText.length, end + ANCHOR_CONTEXT_TARGET_CHARS),
  );

  if (
    normalizeForStrictMatch(expectedBefore) !==
      normalizeForStrictMatch(proposal.before_context) ||
    normalizeForStrictMatch(expectedAfter) !==
      normalizeForStrictMatch(proposal.after_context)
  ) {
    throw new Error(
      `Proposal ${proposal.id} before/after context verification failed.`,
    );
  }

  return { start, end };
}

export function preflightAcceptedChanges(
  sourceText: string,
  proposals: ChangeProposal[],
): ChangeProposal[] {
  const actionable = proposals.filter(isActionableProposal);
  const ordered = sortProposalsForApply(actionable);

  for (const proposal of ordered) {
    validateProposalAgainstSource(sourceText, proposal);
  }

  assertNoOverlapsOrDuplicateRanges(ordered);

  return ordered;
}

export function applyProposalsBatchStrict(
  sourceText: string,
  proposals: ChangeProposal[],
): ApplyBatchResult {
  const ordered = preflightAcceptedChanges(sourceText, proposals);

  let outputText = sourceText;

  for (const proposal of ordered) {
    const { start, end } = getValidatedRange(proposal, outputText.length);
    outputText =
      outputText.slice(0, start) +
      getReplacementText(proposal) +
      outputText.slice(end);
  }

  return {
    output_text: outputText,
    applied_count: ordered.length,
  };
}