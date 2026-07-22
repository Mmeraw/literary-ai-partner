export const SIPOC_STAGE_IDS = [
  "S01_INTAKE",
  "S02_QUEUE",
  "S03_CLAIM",
  "S04_ROUTING_CHUNKING",
  "S05_PASS1",
  "S06_PASS2",
  "S07_PASS3",
  "S08_ER2_NORMALIZATION",
  "S09_QUALITYGATEV2",
  "S10_PERSISTENCE",
  "S10b_PHASE5_AUTHOR_EXPOSURE_GATE",
  "S10c_VIEWMODEL_BOUNDARY_GATE",
  "S11_RENDERER",
  "S11a_RENDERER_WEBPAGE",
  "S11b_DOWNLOAD_PIPELINE",
] as const;

export type SipocStageId = (typeof SIPOC_STAGE_IDS)[number];

export const SIPOC_STAGE_FILENAME_PREFIX: Record<SipocStageId, string> = {
  S01_INTAKE: "s01",
  S02_QUEUE: "s02",
  S03_CLAIM: "s03",
  S04_ROUTING_CHUNKING: "s04",
  S05_PASS1: "s05",
  S06_PASS2: "s06",
  S07_PASS3: "s07",
  S08_ER2_NORMALIZATION: "s08",
  S09_QUALITYGATEV2: "s09",
  S10_PERSISTENCE: "s10",
  S10b_PHASE5_AUTHOR_EXPOSURE_GATE: "s10b",
  S10c_VIEWMODEL_BOUNDARY_GATE: "s10c",
  S11_RENDERER: "s11",
  S11a_RENDERER_WEBPAGE: "s11a",
  S11b_DOWNLOAD_PIPELINE: "s11b",
};

export const EVIDENCE_KINDS = [
  "runtime_fail_closed",
  "static_architecture_invariant",
  "pure_predicate_contract",
  "integration_transactional",
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const OBLIGATION_STATES = [
  "satisfied",
  "satisfied_but_unmapped",
  "representable_but_unproven",
  "unrepresentable",
  "policy_conflict",
  "runtime_conflict",
] as const;
export type ObligationState = (typeof OBLIGATION_STATES)[number];

export const GAP_BUCKETS = [
  "representation_gap",
  "evidence_gap",
  "enforcement_gap",
  "policy_contradiction",
] as const;
export type GapBucket = (typeof GAP_BUCKETS)[number];

export const REMEDIATION_CLASSES = [
  "governance_mapping",
  "integration_evidence",
  "test_infrastructure",
  "runtime",
  "policy",
] as const;
export type RemediationClass = (typeof REMEDIATION_CLASSES)[number];

export const EVIDENCE_MANIFEST_FILENAME = "evidence-obligations.v3.json";
export const NON_FIXTURE_JSON_FILES = new Set([
  "schema.json",
  EVIDENCE_MANIFEST_FILENAME,
]);

export interface EvidenceReference {
  test_file: string;
  test_name: string;
}

export interface EvidenceObligation {
  id: string;
  boundary: SipocStageId;
  dirty_data_rule: string;
  evidence_kind: EvidenceKind;
  enforcement_point: string;
  current_state: ObligationState;
  gap_bucket: GapBucket | null;
  remediation_class: RemediationClass;
  evidence_refs: EvidenceReference[];
  gap: string | null;
  expires_before_utc: string | null;
  blocked_by?: "gate_15_product_policy_ruling";
}

export interface EvidenceManifest {
  schema_version: 3;
  generated_from: string;
  obligations: EvidenceObligation[];
}

export function isSipocStageId(value: unknown): value is SipocStageId {
  return typeof value === "string" && (SIPOC_STAGE_IDS as readonly string[]).includes(value);
}

export function deriveBoundaryEvidenceState(obligations: EvidenceObligation[]): {
  proven: boolean;
  total: number;
  satisfied: number;
  unresolved: string[];
} {
  const unresolved = obligations
    .filter((item) => item.current_state !== "satisfied")
    .map((item) => item.id);
  return {
    proven: obligations.length > 0 && unresolved.length === 0,
    total: obligations.length,
    satisfied: obligations.length - unresolved.length,
    unresolved,
  };
}
