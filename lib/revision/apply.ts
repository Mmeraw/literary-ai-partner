import { createDerivedVersion, getVersionById } from "@/lib/manuscripts/versions";
import { hydrateSourceVersionIfMissing } from "@/lib/manuscripts/hydrateVersions";
import { logRevisionEvent } from "./logRevisionEvent";
import { transitionRevisionSessionState } from "./sessionTransitions";
import { getRevisionSessionById, listProposalsForSession } from "./sessions";
import { ANCHOR_CONTEXT_TARGET_CHARS, normalizeForStrictMatch } from "./anchorContract";
import { preflightAcceptedChanges } from "./applyBatch";
import type { ApplyRevisionSessionResult, ChangeProposal } from "./types";

type ApplyTelemetryContext = {
  revisionSessionId: string;
  evaluationRunId: string;
  manuscriptId: number;
  manuscriptVersionId: string;
};

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
    Number.isInteger(proposal.start_offset) &&
    Number.isInteger(proposal.end_offset) &&
    (proposal.start_offset as number) >= 0 &&
    (proposal.end_offset as number) > (proposal.start_offset as number);

  if (!hasAnchor) {
    void logRevisionEvent({
      revision_session_id: context.revisionSessionId,
      proposal_id: proposal.id,
      manuscript_id: context.manuscriptId,
      manuscript_version_id: context.manuscriptVersionId,
      evaluation_run_id: context.evaluationRunId,
      event_type: "apply",
      severity: "error",
      event_code: "APPLY_ANCHORED_MISSING_OFFSETS",
      message: `Proposal ${proposal.id} missing valid anchor offsets; fail-closed apply enforced.`,
    });

    throw new Error(
      `Proposal ${proposal.id} missing valid anchor offsets; apply requires deterministic anchored coordinates.`,
    );
  }

  const start = proposal.start_offset as number;
  const end = proposal.end_offset as number;

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
        start_offset: start,
        end_offset: end,
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
        start_offset: start,
        end_offset: end,
        expected_length: expectedSlice.length,
        actual_length: actualSlice.length,
      },
    });

    throw new Error(
      `Proposal ${proposal.id} anchored slice does not match original_text.`,
    );
  }

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
        start_offset: start,
        end_offset: end,
      },
    });

    throw new Error(
      `Proposal ${proposal.id} before/after context verification failed.`,
    );
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
      start_offset: start,
      end_offset: end,
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
  const ordered = preflightAcceptedChanges(sourceText, proposals);

  let result = sourceText;

  for (const proposal of ordered) {
    if (proposal.decision !== "accepted" && proposal.decision !== "modified") {
      continue;
    }

    // Hardened behavior: strict anchored replacement only. Fail closed.
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
