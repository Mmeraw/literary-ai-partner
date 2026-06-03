export type ClaimEvidenceIssueCode =
  | "CLAIM_ATTRIBUTION_DRIFT"
  | "CERTAINTY_UPGRADE"
  | "POV_ERASURE"
  | "UNSUPPORTED_NAMED_ENTITY_ACTION";

export type ClaimEvidenceInput = {
  path: string;
  claimText: string;
  evidenceText?: string | null;
};

export type ClaimEvidenceIssue = {
  code: ClaimEvidenceIssueCode;
  path: string;
  message: string;
  claimText: string;
  evidenceText: string;
};

export type ClaimEvidenceEntailmentResult =
  | { ok: true; issues: [] }
  | { ok: false; issues: ClaimEvidenceIssue[] };

const UNCERTAINTY_RE = /\b(seem(?:ed|s)?|appear(?:ed|s)?|apparently|may\s+have|might\s+have|could\s+have|likely|perhaps|probably|possibly|infer(?:red|s)?|suspect(?:ed|s)?|suggest(?:ed|s)?)\b/i;

const DIRECT_ACTION_RE = /\b(spill(?:ed|s|ing)?|tip(?:ped|s|ping)?|disturb(?:ed|s|ing)?|unsettle(?:d|s|ing)?|cause(?:d|s|ing)?|kill(?:ed|s|ing)?|move(?:d|s|ing)?|carry(?:ied|ies|ing)?|plant(?:ed|s|ing)?|hide(?:s|den|ing)?|steal(?:s|ing)?|stole)\b/i;

const SHARD_CONTAINER_RE = /\b(shard|cask|casket|container|urn|stash|residue)\b/i;
const BRUTUS_RE = /\b(Brutus|Red-spots|Red\s*spots)\b/i;
const ZIMEON_RE = /\b(Zimeon|Simeon)\b/i;

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function hasUncertaintyMarker(text: string): boolean {
  return UNCERTAINTY_RE.test(text);
}

function hasDirectAction(text: string): boolean {
  return DIRECT_ACTION_RE.test(text);
}

function mentionsShardContainer(text: string): boolean {
  return SHARD_CONTAINER_RE.test(text);
}

function isBrutusShardContainerDirectClaim(claim: string): boolean {
  const normalized = normalizeText(claim);
  if (!BRUTUS_RE.test(normalized)) return false;
  if (!mentionsShardContainer(normalized)) return false;

  return (
    /\bBrutus[’']s\s+spilled\s+shard\s+cask\b/i.test(normalized) ||
    /\bBrutus\b[^.?!]{0,120}\b(spilled|tipped|disturbed|unsettled)\b[^.?!]{0,120}\b(cask|casket|container|urn|stash|shard)\b/i.test(normalized) ||
    /\b(cask|casket|container|urn|stash|shard)\b[^.?!]{0,120}\b(was|is)\s+(spilled|tipped|disturbed|unsettled)\s+by\s+\bBrutus\b/i.test(normalized)
  );
}

function evidenceFramesCaskAsZimeonInference(evidence: string): boolean {
  const normalized = normalizeText(evidence);
  if (!mentionsShardContainer(normalized)) return false;

  return (
    ZIMEON_RE.test(normalized) ||
    /\bIt\s+seemed\s+Red-spots\s+had\s+unsettled\s+the\s+wooden\s+cask\b/i.test(normalized) ||
    (/\bRed-spots\b/i.test(normalized) && /\bunsettled\b/i.test(normalized) && /\bwooden\s+cask\b/i.test(normalized))
  );
}

function claimPreservesInference(claim: string): boolean {
  const normalized = normalizeText(claim);
  return hasUncertaintyMarker(normalized) || /\bZimeon\b[^.?!]{0,120}\b(infers|suspects|observes|finds|discovers|sees)\b/i.test(normalized);
}

function validateSingleClaim(input: ClaimEvidenceInput): ClaimEvidenceIssue[] {
  const claim = normalizeText(input.claimText);
  const evidence = normalizeText(input.evidenceText);
  if (!claim) return [];

  const issues: ClaimEvidenceIssue[] = [];

  if (isBrutusShardContainerDirectClaim(claim)) {
    if (!evidence || evidenceFramesCaskAsZimeonInference(evidence) || !claimPreservesInference(claim)) {
      issues.push({
        code: "CLAIM_ATTRIBUTION_DRIFT",
        path: input.path,
        message:
          "Author-facing claim assigns the shard-container event directly to Brutus, but the evidence frames it as Zimeon's observation/inference. Preserve actor, POV, and uncertainty.",
        claimText: claim,
        evidenceText: evidence,
      });
    }
  }

  if (
    evidence &&
    hasUncertaintyMarker(evidence) &&
    !hasUncertaintyMarker(claim) &&
    hasDirectAction(claim) &&
    mentionsShardContainer(claim) &&
    (BRUTUS_RE.test(claim) || BRUTUS_RE.test(evidence))
  ) {
    issues.push({
      code: "CERTAINTY_UPGRADE",
      path: input.path,
      message:
        "Author-facing claim upgrades uncertain evidence into a direct factual assertion. Render as inference, possibility, or character perception unless directly shown.",
      claimText: claim,
      evidenceText: evidence,
    });
  }

  const unique = new Map<string, ClaimEvidenceIssue>();
  for (const issue of issues) {
    unique.set(`${issue.code}:${issue.path}`, issue);
  }
  return [...unique.values()];
}

export function validateClaimEvidenceEntailment(inputs: ClaimEvidenceInput[]): ClaimEvidenceEntailmentResult {
  const issues = inputs.flatMap(validateSingleClaim);
  return issues.length === 0 ? { ok: true, issues: [] } : { ok: false, issues };
}
