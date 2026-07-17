import { createHash } from 'node:crypto';

export type RevisionCandidateSlot = 'A' | 'B' | 'C';

export type RevisionAuthorityOptionIdentity = {
  candidateSlot: RevisionCandidateSlot;
  candidateHash: string;
};

type RevisionAuthorityOpportunityInput = {
  id: string;
  sourceUedHash?: string | null;
  sourceOpportunityId?: string | null;
  sourceCriterion?: string | null;
  sourceExcerpt?: string | null;
  sourceLocation?: string | null;
  cardType?: string | null;
  trustedPathStatus?: string | null;
  options?: Array<{ key?: string | null; candidateText?: string | null; text?: string | null }>;
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown): string {
  return createHash('sha256').update(stableStringify(value), 'utf8').digest('hex');
}

export function normalizeRevisionAuthorityText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

export function normalizeRevisionAuthorityComparison(value: string | null | undefined): string {
  return normalizeRevisionAuthorityText(value).toLowerCase();
}

export function revisionCandidateHash(input: {
  opportunityId: string;
  candidateSlot: RevisionCandidateSlot;
  candidateText: string | null | undefined;
  sourceUedHash?: string | null;
  sourceOpportunityId?: string | null;
  sourceCriterion?: string | null;
}): string {
  return sha256({
    identity_type: 'revision_candidate_identity_v1',
    opportunity_id: normalizeRevisionAuthorityText(input.opportunityId),
    candidate_slot: input.candidateSlot,
    candidate_text_normalized: normalizeRevisionAuthorityText(input.candidateText),
    source_ued_hash: normalizeRevisionAuthorityText(input.sourceUedHash),
    source_opportunity_id: normalizeRevisionAuthorityText(input.sourceOpportunityId),
    source_criterion: normalizeRevisionAuthorityComparison(input.sourceCriterion),
  });
}

export function revisionOpportunityVersion(input: RevisionAuthorityOpportunityInput): string {
  const candidateIdentities = (input.options ?? [])
    .map((option) => {
      const key = normalizeRevisionAuthorityText(option.key).toUpperCase();
      if (key !== 'A' && key !== 'B' && key !== 'C') return null;
      return {
        candidate_slot: key,
        candidate_hash: revisionCandidateHash({
          opportunityId: input.id,
          candidateSlot: key,
          candidateText: option.candidateText ?? option.text ?? '',
          sourceUedHash: input.sourceUedHash,
          sourceOpportunityId: input.sourceOpportunityId,
          sourceCriterion: input.sourceCriterion,
        }),
      };
    })
    .filter((item): item is { candidate_slot: RevisionCandidateSlot; candidate_hash: string } => item !== null)
    .sort((a, b) => a.candidate_slot.localeCompare(b.candidate_slot));

  return sha256({
    identity_type: 'revision_opportunity_version_v1',
    opportunity_id: normalizeRevisionAuthorityText(input.id),
    source_ued_hash: normalizeRevisionAuthorityText(input.sourceUedHash),
    source_opportunity_id: normalizeRevisionAuthorityText(input.sourceOpportunityId),
    source_criterion: normalizeRevisionAuthorityComparison(input.sourceCriterion),
    source_excerpt: normalizeRevisionAuthorityText(input.sourceExcerpt),
    source_location: normalizeRevisionAuthorityText(input.sourceLocation),
    card_type: normalizeRevisionAuthorityText(input.cardType),
    trusted_path_status: normalizeRevisionAuthorityText(input.trustedPathStatus),
    candidates: candidateIdentities,
  });
}

export function revisionCandidateIdentitiesBySlot(input: RevisionAuthorityOpportunityInput): Map<RevisionCandidateSlot, string> {
  const identities = new Map<RevisionCandidateSlot, string>();
  for (const option of input.options ?? []) {
    const key = normalizeRevisionAuthorityText(option.key).toUpperCase();
    if (key !== 'A' && key !== 'B' && key !== 'C') continue;
    identities.set(key, revisionCandidateHash({
      opportunityId: input.id,
      candidateSlot: key,
      candidateText: option.candidateText ?? option.text ?? '',
      sourceUedHash: input.sourceUedHash,
      sourceOpportunityId: input.sourceOpportunityId,
      sourceCriterion: input.sourceCriterion,
    }));
  }
  return identities;
}
