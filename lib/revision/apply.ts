import { createDerivedVersion, getVersionById } from "@/lib/manuscripts/versions";
import { hydrateSourceVersionIfMissing } from "@/lib/manuscripts/hydrateVersions";
import { logRevisionEvent } from "./logRevisionEvent";
import { transitionRevisionSessionState } from "./sessionTransitions";
import { getRevisionSessionById, listProposalsForSession } from "./sessions";
import type { ApplyRevisionSessionResult, ChangeProposal } from "./types";

type ApplyTelemetryContext = {
  revisionSessionId: string;
  evaluationRunId: string;
  manuscriptId: number;
  manuscriptVersionId: string;
};

function normalizeForStrictMatch(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function applySingleReplacementStrict(
  currentText: string,
  originalText: string,
  replacement: string,
  proposalId: string,
  context: ApplyTelemetryContext,
): string {
  const normalizedCurrentText = normalizeForStrictMatch(currentText);
  const needle = normalizeForStrictMatch(originalText);
  const normalizedReplacement = normalizeForStrictMatch(replacement);

  if (!needle || needle.trim().length === 0) {
    throw new Error(
      `Proposal ${proposalId} has empty original_text. ` +
        `Location-aware apply is required for empty-anchor edits.`,
    );
  }

  const firstIdx = normalizedCurrentText.indexOf(needle);
  if (firstIdx < 0) {
    void logRevisionEvent({
      revision_session_id: context.revisionSessionId,
      proposal_id: proposalId,
      manuscript_id: context.manuscriptId,
      manuscript_version_id: context.manuscriptVersionId,
      evaluation_run_id: context.evaluationRunId,
      event_type: "apply",
      severity: "error",
      event_code: "APPLY_LEGACY_NOT_FOUND",
      message: `Proposal ${proposalId} original_text not found in source text.`,
      metadata: {
        original_text_length: originalText.length,
      },
    });

    throw new Error(
      `Proposal ${proposalId} original_text not found in source text. ` +
        `Refine proposal extraction or adopt location-aware apply.`,
    );
  }

  const secondIdx = normalizedCurrentText.indexOf(needle, firstIdx + needle.length);
  if (secondIdx >= 0) {
    void logRevisionEvent({
      revision_session_id: context.revisionSessionId,
      proposal_id: proposalId,
      manuscript_id: context.manuscriptId,
      manuscript_version_id: context.manuscriptVersionId,
      evaluation_run_id: context.evaluationRunId,
      event_type: "apply",
      severity: "error",
      event_code: "APPLY_LEGACY_AMBIGUOUS",
      message: `Proposal ${proposalId} original_text is ambiguous in source text.`,
      metadata: {
        original_text_length: originalText.length,
      },
    });

    throw new Error(
      `Proposal ${proposalId} original_text is ambiguous (multiple matches). ` +
        `Location-aware apply is required.`,
    );
  }

  void logRevisionEvent({
    revision_session_id: context.revisionSessionId,
    proposal_id: proposalId,
    manuscript_id: context.manuscriptId,
    manuscript_version_id: context.manuscriptVersionId,
    evaluation_run_id: context.evaluationRunId,
    event_type: "apply",
    event_code: "APPLY_LEGACY_FALLBACK_SUCCESS",
    metadata: {
      original_text_length: originalText.length,
      replacement_length: replacement.length,
    },
  });

  return (
    normalizedCurrentText.slice(0, firstIdx) +
    normalizedReplacement +
    normalizedCurrentText.slice(firstIdx + needle.length)
  );
}

function applySingleReplacementAnchoredStrict(
  sourceText: string,
  proposal: ChangeProposal,
  context: ApplyTelemetryContext,
): string {
  const replacement =
    proposal.decision === "modified"
      ? (proposal.modified_text ?? proposal.proposed_text)
      : proposal.proposed_text;

  const hasAnchor =
    Number.isInteger(proposal.anchor_start) &&
    Number.isInteger(proposal.anchor_end) &&
    (proposal.anchor_start as number) >= 0 &&
    (proposal.anchor_end as number) > (proposal.anchor_start as number);

  // Legacy fallback for pre-anchor proposals.
  if (!hasAnchor) {
    return applySingleReplacementStrict(
      sourceText,
      proposal.original_text,
      replacement,
      proposal.id,
      context,
    );
  }

  const start = proposal.anchor_start as number;
  const end = proposal.anchor_end as number;

  if (end > sourceText.length) {
    void logRevisionEvent({
      revision_session_id: context.revisionSessionId,
      proposal_id: proposal.id,
      manuscript_id: context.manuscriptId,
      manuscript_version_id: context.manuscriptVersionId,
      evaluation_run_id: context.evaluationRunId,
      event_type: "apply",
      severity: "error",
      event_code: "APPLY_ANCHORED_SLICE_MISMATCH",
      message: `Proposal ${proposal.id} anchor range exceeds source length.`,
      metadata: {
        anchor_start: start,
        anchor_end: end,
        source_length: sourceText.length,
      },
    });

    throw new Error(`Proposal ${proposal.id} anchor range exceeds source length.`);
  }

  const actualSlice = sourceText.slice(start, end);
  const expectedSlice = proposal.original_text;

  if (
    normalizeForStrictMatch(actualSlice) !==
    normalizeForStrictMatch(expectedSlice)
  ) {
    void logRevisionEvent({
      revision_session_id: context.revisionSessionId,
      proposal_id: proposal.id,
      manuscript_id: context.manuscriptId,
      manuscript_version_id: context.manuscriptVersionId,
      evaluation_run_id: context.evaluationRunId,
      event_type: "apply",
      severity: "error",
      event_code: "APPLY_ANCHORED_SLICE_MISMATCH",
      message: `Anchored slice did not match original_text for proposal ${proposal.id}.`,
      metadata: {
        anchor_start: start,
        anchor_end: end,
        expected_length: expectedSlice.length,
        actual_length: actualSlice.length,
      },
    });

    throw new Error(
      `Proposal ${proposal.id} anchored slice does not match original_text.`,
    );
  }

  if (proposal.anchor_context) {
    const contextLeft = Math.max(0, start - 80);
    const contextRight = Math.min(sourceText.length, end + 80);
    const actualContext = sourceText.slice(contextLeft, contextRight);

    if (
      !normalizeForStrictMatch(actualContext).includes(
        normalizeForStrictMatch(proposal.anchor_context),
      )
    ) {
      void logRevisionEvent({
        revision_session_id: context.revisionSessionId,
        proposal_id: proposal.id,
        manuscript_id: context.manuscriptId,
        manuscript_version_id: context.manuscriptVersionId,
        evaluation_run_id: context.evaluationRunId,
        event_type: "apply",
        severity: "error",
        event_code: "APPLY_ANCHORED_CONTEXT_MISMATCH",
        message: `Anchor context verification failed for proposal ${proposal.id}.`,
        metadata: {
          anchor_start: start,
          anchor_end: end,
        },
      });

      throw new Error(
        `Proposal ${proposal.id} anchor_context verification failed.`,
      );
    }
  }

  void logRevisionEvent({
    revision_session_id: context.revisionSessionId,
    proposal_id: proposal.id,
    manuscript_id: context.manuscriptId,
    manuscript_version_id: context.manuscriptVersionId,
    evaluation_run_id: context.evaluationRunId,
    event_type: "apply",
    event_code: "APPLY_ANCHORED_SUCCESS",
    metadata: {
      anchor_start: start,
      anchor_end: end,
      replacement_length: replacement.length,
    },
  });

  return sourceText.slice(0, start) + replacement + sourceText.slice(end);
}

function applyAcceptedChanges(
  sourceText: string,
  proposals: ChangeProposal[],
  context: ApplyTelemetryContext,
): string {
  const ordered = [...proposals].sort((a, b) => {
    const aStart = a.anchor_start ?? -1;
    const bStart = b.anchor_start ?? -1;
    return bStart - aStart;
  });

  let result = sourceText;

  for (const proposal of ordered) {
    if (proposal.decision !== "accepted" && proposal.decision !== "modified") {
      continue;
    }

    // Hardened behavior: prefer strict anchored replacement when offsets exist,
    // otherwise fall back to strict single-match text replacement. Fail closed.
    result = applySingleReplacementAnchoredStrict(result, proposal, context);
  }

  return result;
}

export async function applyRevisionSession(
  revisionSessionId: string,
): Promise<ApplyRevisionSessionResult> {
  const session = await getRevisionSessionById(revisionSessionId);
  if (!session) {
    throw new Error(`Revision session not found: ${revisionSessionId}`);
  }

  if (session.status !== "proposals_ready") {
    throw new Error(
      `Revision session ${revisionSessionId} is not ready to apply; current status: ${session.status}`,
    );
  }

  const sourceVersion = await getVersionById(session.source_version_id);
  if (!sourceVersion) {
    throw new Error(`Source version not found: ${session.source_version_id}`);
  }

  let sourceText = sourceVersion.raw_text;
  if (typeof sourceText !== "string" || sourceText.trim().length === 0) {
    const hydrated = await hydrateSourceVersionIfMissing(sourceVersion.id, {
      persist: false,
    });
    sourceText = hydrated.raw_text ?? "";

    if (sourceText.trim().length === 0) {
      throw new Error(
        `Source version ${sourceVersion.id} has empty raw_text and could not be hydrated from manuscript source.`,
      );
    }
  }

  const proposals = await listProposalsForSession(revisionSessionId);

  const acceptedOrModified = proposals.filter(
    (p) => p.decision === "accepted" || p.decision === "modified",
  );

  if (acceptedOrModified.length === 0) {
    throw new Error("No accepted or modified proposals to apply.");
  }

  const nextText = applyAcceptedChanges(sourceText, acceptedOrModified, {
    revisionSessionId,
    evaluationRunId: session.evaluation_run_id,
    manuscriptId: sourceVersion.manuscript_id,
    manuscriptVersionId: sourceVersion.id,
  });

  const resultVersion = await createDerivedVersion({
    manuscript_id: sourceVersion.manuscript_id,
    source_version_id: sourceVersion.id,
    raw_text: nextText,
    word_count: nextText.trim() ? nextText.trim().split(/\s+/).length : 0,
  });

  const acceptedCount = proposals.filter((p) => p.decision === "accepted").length;
  const modifiedCount = proposals.filter((p) => p.decision === "modified").length;

  await transitionRevisionSessionState(revisionSessionId, {
    nextStatus: "applied",
    result_version_id: resultVersion.id,
    proposals_created_count: proposals.length,
    summary: {
      accepted_count: acceptedCount,
      modified_count: modifiedCount,
      source_version_id: sourceVersion.id,
      result_version_id: resultVersion.id,
    },
  });

  return {
    revision_session_id: revisionSessionId,
    source_version_id: sourceVersion.id,
    result_version_id: resultVersion.id,
    accepted_count: acceptedCount,
    modified_count: modifiedCount,
  };
}
