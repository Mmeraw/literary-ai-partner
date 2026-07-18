import {
  normalizeRevisionAuthorityComparison,
  revisionCandidateIdentitiesBySlot,
  revisionOpportunityVersion,
  type RevisionCandidateSlot,
} from "@/lib/revision/decisionAuthorityIdentity";
import { scrubInternalReportLeakage } from "@/lib/revision/finalReviewSourceText";
import { countOccurrences } from "@/lib/revision/finalReviewPresentation";

export type MaterializableDecision = {
  id: string;
  opportunity_id: string;
  opportunity_title: string;
  decision: string;
  selected_option: string | null;
  custom_text: string | null;
  selected_text: string | null;
  source_excerpt: string | null;
  source_location: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type MaterializableOpportunity = {
  id: string;
  cardType: string | null;
  trustedPathStatus: string | null;
  sourceExcerpt: string;
  sourceLocation: string | null;
  sourceUedHash: string | null;
  sourceOpportunityId: string | null;
  sourceCriterion: string | null;
  optionTextByKey: Map<string, string>;
  candidateHashByKey: Map<RevisionCandidateSlot, string>;
  opportunityVersion: string;
};

export type MaterializationContext = {
  sourceText: string;
  decisions: MaterializableDecision[];
  opportunitiesById: Map<string, MaterializableOpportunity>;
};

export type RejectedDecision = {
  decisionId: string;
  reason: string;
};

export type MaterializationResult = {
  text: string;
  appliedDecisionIds: string[];
  rejectedDecisions: RejectedDecision[];
};

const APPLICABLE = new Set(["accepted_a", "accepted_b", "accepted_c", "custom"]);

type OpportunitySourceInput = {
  id: string;
  cardType?: string | null;
  trustedPathStatus?: string | null;
  quoteHighlight?: string | null;
  quoteRest?: string | null;
  anchor?: string | null;
  sourceUedHash?: string | null;
  sourceOpportunityId?: string | null;
  sourceCriterion?: string | null;
  options?: Array<{ key?: string | null; candidateText?: string | null; text?: string | null }>;
};

function sourceTextOfQueueOpportunity(opportunity: { quoteHighlight?: string | null; quoteRest?: string | null }): string {
  return `${opportunity.quoteHighlight ?? ""}${opportunity.quoteRest ?? ""}`.trim();
}

export function toMaterializableOpportunity(opportunity: OpportunitySourceInput): MaterializableOpportunity {
  const optionTextByKey = new Map<string, string>();
  for (const option of opportunity.options ?? []) {
    const key = (option.key ?? "").trim().toUpperCase();
    if (!key) continue;
    const candidate = (option.candidateText ?? option.text ?? "").trim();
    optionTextByKey.set(key, candidate);
  }

  const sourceExcerpt = sourceTextOfQueueOpportunity(opportunity);
  const sourceLocation = typeof opportunity.anchor === "string" ? opportunity.anchor : null;
  const sourceUedHash = typeof opportunity.sourceUedHash === "string" ? opportunity.sourceUedHash : null;
  const sourceOpportunityId = typeof opportunity.sourceOpportunityId === "string" ? opportunity.sourceOpportunityId : null;
  const sourceCriterion = typeof opportunity.sourceCriterion === "string" ? opportunity.sourceCriterion : null;
  const cardType = typeof opportunity.cardType === "string" ? opportunity.cardType : null;
  const trustedPathStatus = typeof opportunity.trustedPathStatus === "string" ? opportunity.trustedPathStatus : null;

  const identityInput = {
    id: opportunity.id,
    sourceUedHash,
    sourceOpportunityId,
    sourceCriterion,
    sourceExcerpt,
    sourceLocation,
    cardType,
    trustedPathStatus,
    options: opportunity.options,
  };

  return {
    id: opportunity.id,
    cardType,
    trustedPathStatus,
    sourceExcerpt,
    sourceLocation,
    sourceUedHash,
    sourceOpportunityId,
    sourceCriterion,
    optionTextByKey,
    candidateHashByKey: revisionCandidateIdentitiesBySlot(identityInput),
    opportunityVersion: revisionOpportunityVersion(identityInput),
  };
}

function metadataValueAsString(metadata: Record<string, unknown> | null | undefined, key: string): string | null {
  const raw = metadata?.[key];
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

function metadataCandidateSlot(metadata: Record<string, unknown> | null | undefined): RevisionCandidateSlot | null {
  const slot = metadataValueAsString(metadata, "candidateSlot")?.toUpperCase();
  return slot === "A" || slot === "B" || slot === "C" ? slot : null;
}

function validateDecisionAgainstAuthority(
  ctx: MaterializationContext,
  decision: MaterializableDecision,
): string | null {
  const queueOpportunity = ctx.opportunitiesById.get(decision.opportunity_id);
  if (!queueOpportunity) {
    return `${decision.opportunity_title}: opportunity missing from authoritative copy-paste queue.`;
  }

  if (queueOpportunity.cardType !== "copy_paste_rewrite" || queueOpportunity.trustedPathStatus !== "eligible") {
    return `${decision.opportunity_title}: opportunity is no longer TrustedPath-eligible for copy-paste apply.`;
  }

  const decisionOpportunityVersion = metadataValueAsString(decision.metadata, "opportunityVersion");
  if (!decisionOpportunityVersion) {
    return `${decision.opportunity_title}: decision is missing authoritative opportunityVersion; Final Review cannot prove opportunity-version identity.`;
  }
  if (decisionOpportunityVersion !== queueOpportunity.opportunityVersion) {
    return `${decision.opportunity_title}: opportunity version mismatch; decision was saved against a stale persisted opportunity version.`;
  }

  if (decision.decision === "accepted_a" || decision.decision === "accepted_b" || decision.decision === "accepted_c") {
    const selectedOption = (decision.selected_option ?? "").trim().toUpperCase();
    if (selectedOption !== "A" && selectedOption !== "B" && selectedOption !== "C") {
      return `${decision.opportunity_title}: accepted decision is missing selected option.`;
    }

    const candidateSlot = metadataCandidateSlot(decision.metadata);
    if (!candidateSlot) {
      return `${decision.opportunity_title}: accepted decision is missing authoritative candidateSlot.`;
    }
    if (candidateSlot !== selectedOption) {
      return `${decision.opportunity_title}: candidateSlot ${candidateSlot} does not match selected option ${selectedOption}.`;
    }

    const authoritativeCandidate = queueOpportunity.optionTextByKey.get(selectedOption) ?? "";
    if (!authoritativeCandidate.trim()) {
      return `${decision.opportunity_title}: authoritative candidate ${selectedOption} is missing in the current persisted opportunity.`;
    }

    const decisionCandidateHash = metadataValueAsString(decision.metadata, "candidateHash");
    if (!decisionCandidateHash) {
      return `${decision.opportunity_title}: accepted decision is missing authoritative candidateHash.`;
    }
    const authoritativeCandidateHash = queueOpportunity.candidateHashByKey.get(candidateSlot);
    if (!authoritativeCandidateHash) {
      return `${decision.opportunity_title}: authoritative candidateHash for slot ${selectedOption} is missing in the current persisted opportunity.`;
    }
    if (decisionCandidateHash !== authoritativeCandidateHash) {
      return `${decision.opportunity_title}: candidate identity mismatch for slot ${selectedOption}; decision was saved against a stale candidate set.`;
    }

    if (
      normalizeRevisionAuthorityComparison(decision.selected_text) !==
      normalizeRevisionAuthorityComparison(authoritativeCandidate)
    ) {
      return `${decision.opportunity_title}: selected text diagnostic mismatch for authoritative candidate ${selectedOption}; candidate identity matched but persisted replacement text differs.`;
    }
  }

  const authoritativeExcerpt = queueOpportunity.sourceExcerpt;
  if (!authoritativeExcerpt) {
    return `${decision.opportunity_title}: authoritative source excerpt is missing for apply identity validation.`;
  }

  if (normalizeRevisionAuthorityComparison(decision.source_excerpt) !== normalizeRevisionAuthorityComparison(authoritativeExcerpt)) {
    return `${decision.opportunity_title}: source identity mismatch (decision excerpt no longer matches authoritative opportunity excerpt).`;
  }

  if (normalizeRevisionAuthorityComparison(decision.source_location) !== normalizeRevisionAuthorityComparison(queueOpportunity.sourceLocation)) {
    return `${decision.opportunity_title}: source identity mismatch (decision location no longer matches authoritative opportunity location).`;
  }

  const decisionSourceUedHash = metadataValueAsString(decision.metadata, "sourceUedHash");
  if (decisionSourceUedHash && queueOpportunity.sourceUedHash && decisionSourceUedHash !== queueOpportunity.sourceUedHash) {
    return `${decision.opportunity_title}: source identity mismatch (decision sourceUedHash differs from authoritative persisted opportunity).`;
  }

  const decisionSourceOpportunityId = metadataValueAsString(decision.metadata, "sourceOpportunityId");
  if (decisionSourceOpportunityId && queueOpportunity.sourceOpportunityId && decisionSourceOpportunityId !== queueOpportunity.sourceOpportunityId) {
    return `${decision.opportunity_title}: source identity mismatch (decision sourceOpportunityId differs from authoritative persisted opportunity).`;
  }

  const decisionSourceCriterion = metadataValueAsString(decision.metadata, "sourceCriterion");
  if (decisionSourceCriterion && queueOpportunity.sourceCriterion && normalizeRevisionAuthorityComparison(decisionSourceCriterion) !== normalizeRevisionAuthorityComparison(queueOpportunity.sourceCriterion)) {
    return `${decision.opportunity_title}: source identity mismatch (decision sourceCriterion differs from authoritative persisted opportunity).`;
  }

  const decisionCardType = metadataValueAsString(decision.metadata, "cardType");
  if (decisionCardType && queueOpportunity.cardType && decisionCardType !== queueOpportunity.cardType) {
    return `${decision.opportunity_title}: stale decision metadata (cardType changed since decision sync).`;
  }

  const decisionTrustedPathStatus = metadataValueAsString(decision.metadata, "trustedPathStatus");
  if (decisionTrustedPathStatus && queueOpportunity.trustedPathStatus && decisionTrustedPathStatus !== queueOpportunity.trustedPathStatus) {
    return `${decision.opportunity_title}: stale decision metadata (trustedPathStatus changed since decision sync).`;
  }

  return null;
}

type AnchoredSnapshot = {
  decision: MaterializableDecision;
  start: number;
  end: number;
  replacement: string;
};

export function applyValidatedFinalReviewDecisions(ctx: MaterializationContext): MaterializationResult {
  const text = scrubInternalReportLeakage(ctx.sourceText);

  if (!text.trim()) {
    return {
      text: "",
      appliedDecisionIds: [],
      rejectedDecisions: [
        {
          decisionId: "source",
          reason: "Full manuscript source text is unavailable for this legacy evaluation.",
        },
      ],
    };
  }

  const rejectedDecisions: RejectedDecision[] = [];
  const allIds = new Set<string>();

  for (const decision of ctx.decisions) {
    if (allIds.has(decision.id)) {
      rejectedDecisions.push({
        decisionId: decision.id,
        reason: `Duplicate decision id ${decision.id} in loaded ledger`,
      });
      break;
    }
    allIds.add(decision.id);
  }

  if (rejectedDecisions.length > 0) {
    return { text, appliedDecisionIds: [], rejectedDecisions };
  }

  const snapshots: AnchoredSnapshot[] = [];
  const seenIds = new Set<string>();

  for (const decision of ctx.decisions) {
    if (!APPLICABLE.has(decision.decision)) continue;

    const authorityViolation = validateDecisionAgainstAuthority(ctx, decision);
    if (authorityViolation) {
      rejectedDecisions.push({ decisionId: decision.id, reason: authorityViolation });
      continue;
    }

    if (seenIds.has(decision.id)) {
      rejectedDecisions.push({
        decisionId: decision.id,
        reason: `${decision.opportunity_title}: duplicate decision id ${decision.id}`,
      });
      continue;
    }
    seenIds.add(decision.id);

    const replacement = scrubInternalReportLeakage(decision.decision === "custom" ? decision.custom_text ?? "" : decision.selected_text ?? "");
    const source = scrubInternalReportLeakage(decision.source_excerpt ?? "");

    if (!replacement || !source) {
      rejectedDecisions.push({
        decisionId: decision.id,
        reason: `${decision.opportunity_title}: missing source excerpt or selected replacement text.`,
      });
      continue;
    }

    const occurrences = countOccurrences(text, source);
    if (occurrences === 0) {
      rejectedDecisions.push({
        decisionId: decision.id,
        reason: `${decision.opportunity_title}: source excerpt anchor was not found in the current manuscript text.`,
      });
      continue;
    }
    if (occurrences > 1) {
      rejectedDecisions.push({
        decisionId: decision.id,
        reason: `${decision.opportunity_title}: source excerpt is not unique in the manuscript.`,
      });
      continue;
    }

    const start = text.indexOf(source);
    snapshots.push({ decision, start, end: start + source.length, replacement });
  }

  if (rejectedDecisions.length === 0 && snapshots.length > 0) {
    const sorted = [...snapshots].sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (curr.start === prev.start && curr.end === prev.end) {
        rejectedDecisions.push({
          decisionId: curr.decision.id,
          reason: `Duplicate edit region detected at offset ${curr.start}`,
        });
      } else if (curr.start < prev.end) {
        rejectedDecisions.push({
          decisionId: curr.decision.id,
          reason: `Overlapping edit regions detected at offsets ${prev.start} and ${curr.start}`,
        });
      }
    }
  }

  if (rejectedDecisions.length > 0) {
    return { text, appliedDecisionIds: [], rejectedDecisions };
  }

  const byDesc = [...snapshots].sort((a, b) => b.start - a.start);
  let result = text;
  for (const snapshot of byDesc) {
    result = result.slice(0, snapshot.start) + snapshot.replacement + result.slice(snapshot.end);
  }

  const appliedDecisionIds = snapshots
    .sort((a, b) => a.start - b.start)
    .map((snapshot) => snapshot.decision.id);

  return { text: result, appliedDecisionIds, rejectedDecisions: [] };
}
