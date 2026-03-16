import { createDerivedVersion, getVersionById } from "@/lib/manuscripts/versions";
import { hydrateSourceVersionIfMissing } from "@/lib/manuscripts/hydrateVersions";
import {
  getRevisionSessionById,
  listProposalsForSession,
  markRevisionSessionApplied,
} from "./sessions";
import type { ApplyRevisionSessionResult, ChangeProposal } from "./types";

function normalizeForStrictMatch(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function applySingleReplacementStrict(
  currentText: string,
  originalText: string,
  replacement: string,
  proposalId: string,
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
    throw new Error(
      `Proposal ${proposalId} original_text not found in source text. ` +
        `Refine proposal extraction or adopt location-aware apply.`,
    );
  }

  const secondIdx = normalizedCurrentText.indexOf(needle, firstIdx + needle.length);
  if (secondIdx >= 0) {
    throw new Error(
      `Proposal ${proposalId} original_text is ambiguous (multiple matches). ` +
        `Location-aware apply is required.`,
    );
  }

  return (
    normalizedCurrentText.slice(0, firstIdx) +
    normalizedReplacement +
    normalizedCurrentText.slice(firstIdx + needle.length)
  );
}

function applyAcceptedChanges(sourceText: string, proposals: ChangeProposal[]): string {
  let result = sourceText;

  for (const proposal of proposals) {
    if (proposal.decision !== "accepted" && proposal.decision !== "modified") {
      continue;
    }

    const replacement =
      proposal.decision === "modified"
        ? (proposal.modified_text ?? proposal.proposed_text)
        : proposal.proposed_text;

    // First-pass behavior (hardened): exact single-match replacement only.
    // If the anchor text is missing or ambiguous, fail closed.
    // Later: replace with location-aware apply via offsets/anchors.
    result = applySingleReplacementStrict(
      result,
      proposal.original_text,
      replacement,
      proposal.id,
    );
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

  if (session.status !== "open") {
    throw new Error(
      `Revision session ${revisionSessionId} is not open; current status: ${session.status}`,
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

  const nextText = applyAcceptedChanges(sourceText, acceptedOrModified);

  const resultVersion = await createDerivedVersion({
    manuscript_id: sourceVersion.manuscript_id,
    source_version_id: sourceVersion.id,
    raw_text: nextText,
    word_count: nextText.trim() ? nextText.trim().split(/\s+/).length : 0,
  });

  const acceptedCount = proposals.filter((p) => p.decision === "accepted").length;
  const modifiedCount = proposals.filter((p) => p.decision === "modified").length;

  await markRevisionSessionApplied(revisionSessionId, resultVersion.id, {
    accepted_count: acceptedCount,
    modified_count: modifiedCount,
    source_version_id: sourceVersion.id,
    result_version_id: resultVersion.id,
  });

  return {
    revision_session_id: revisionSessionId,
    source_version_id: sourceVersion.id,
    result_version_id: resultVersion.id,
    accepted_count: acceptedCount,
    modified_count: modifiedCount,
  };
}
