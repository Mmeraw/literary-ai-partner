import type { RuleStage } from "@/lib/governance/lessonsLearned";

export type ExecutionMode = "TRUSTED_PATH" | "STUDIO";

export type GovernanceCheckpointId =
  | "CANON_REGISTRY_BINDING"
  | "CANON_GATE"
  | "LLR_POST_STRUCTURAL"
  | "LLR_POST_DIAGNOSTIC"
  | "LLR_POST_CONVERGENCE"
  | "LLR_PRE_ARTIFACT_GENERATION"
  | "ELIGIBILITY_GATE"
  | "QUALITY_GATE"
  | "HUMAN_REVIEW_BOUNDARY"
  | "ARTIFACT_CERTIFICATION_BOUNDARY"
  | "FAILURE_ESCALATION_DEAD_LETTER";

export type GovernanceAuthority =
  | "AI_GOVERNANCE.md"
  | "docs/JOB_CONTRACT_v1.md"
  | "docs/NOMENCLATURE_CANON_v1.md"
  | "Volume II-A Eligibility Gate"
  | "Phase 0.2 Lessons Learned"
  | "Phase 2.7 Quality Gate"
  | "Operations Runbook";

export type GovernanceAction = "ALLOW" | "WARN" | "BLOCK" | "AUDIT";

export type DownstreamImpact = {
  blocksStages?: Array<"pass1" | "pass2" | "pass3" | "pass4">;
  warnsStages?: Array<"pass1" | "pass2" | "pass3" | "pass4">;
  affectsArtifacts?: boolean;
};

export type GovernanceCheckpoint = {
  id: GovernanceCheckpointId;
  stage: string;
  description: string;
  appliesToExecutionModes: ExecutionMode[];
  authority: GovernanceAuthority;
  primaryAction: GovernanceAction;
  auditEvent: string;
  inputShape: string[];
  outputShape: string[];
  downstreamImpact: DownstreamImpact;
  blockErrorCode?: string;
  llrStage?: RuleStage;
};

export type GovernanceInjectionMap = readonly GovernanceCheckpoint[];

export const REQUIRED_GOVERNANCE_CHECKPOINT_IDS: readonly GovernanceCheckpointId[] = [
  "CANON_REGISTRY_BINDING",
  "CANON_GATE",
  "LLR_POST_STRUCTURAL",
  "LLR_POST_DIAGNOSTIC",
  "LLR_POST_CONVERGENCE",
  "LLR_PRE_ARTIFACT_GENERATION",
  "ELIGIBILITY_GATE",
  "QUALITY_GATE",
  "HUMAN_REVIEW_BOUNDARY",
  "ARTIFACT_CERTIFICATION_BOUNDARY",
  "FAILURE_ESCALATION_DEAD_LETTER",
] as const;

export const DEFAULT_GOVERNANCE_INJECTION_MAP: GovernanceInjectionMap = [
  {
    id: "CANON_REGISTRY_BINDING",
    stage: "pipeline_boot",
    description: "Binds canonical registry before any pass execution.",
    appliesToExecutionModes: ["TRUSTED_PATH", "STUDIO"],
    authority: "docs/NOMENCLATURE_CANON_v1.md",
    primaryAction: "BLOCK",
    auditEvent: "governance.canon_registry.bound",
    inputShape: ["registry_loader"],
    outputShape: ["registry"],
    downstreamImpact: {
      blocksStages: ["pass1", "pass2", "pass3", "pass4"],
      affectsArtifacts: true,
    },
    blockErrorCode: "CANON_REGISTRY_BIND_FAILED",
  },
  {
    id: "CANON_GATE",
    stage: "pipeline_boot",
    description: "Validates canon registry is non-empty before pass execution.",
    appliesToExecutionModes: ["TRUSTED_PATH", "STUDIO"],
    authority: "AI_GOVERNANCE.md",
    primaryAction: "BLOCK",
    auditEvent: "governance.canon_gate.checked",
    inputShape: ["registry"],
    outputShape: ["canon_gate_decision"],
    downstreamImpact: {
      blocksStages: ["pass1", "pass2", "pass3", "pass4"],
      affectsArtifacts: true,
    },
    blockErrorCode: "CANON_REGISTRY_EMPTY",
  },
  {
    id: "LLR_POST_STRUCTURAL",
    stage: "post_pass1",
    description: "Lessons-learned enforcement after structural pass.",
    appliesToExecutionModes: ["TRUSTED_PATH", "STUDIO"],
    authority: "Phase 0.2 Lessons Learned",
    primaryAction: "BLOCK",
    auditEvent: "governance.llr.post_structural",
    inputShape: ["structural_result", "registry", "trace_metadata"],
    outputShape: ["lessons_learned_report", "enforcement_decision"],
    downstreamImpact: {
      blocksStages: ["pass2", "pass3", "pass4"],
      affectsArtifacts: true,
    },
    blockErrorCode: "LLR_POST_STRUCTURAL_BLOCK",
    llrStage: "post_structural",
  },
  {
    id: "LLR_POST_DIAGNOSTIC",
    stage: "post_pass2",
    description: "Lessons-learned enforcement after diagnostic pass.",
    appliesToExecutionModes: ["TRUSTED_PATH", "STUDIO"],
    authority: "Phase 0.2 Lessons Learned",
    primaryAction: "BLOCK",
    auditEvent: "governance.llr.post_diagnostic",
    inputShape: ["structural_result", "diagnostic_result", "registry", "trace_metadata"],
    outputShape: ["lessons_learned_report", "enforcement_decision"],
    downstreamImpact: {
      blocksStages: ["pass3", "pass4"],
      affectsArtifacts: true,
    },
    blockErrorCode: "LLR_POST_DIAGNOSTIC_BLOCK",
    llrStage: "post_diagnostic",
  },
  {
    id: "LLR_POST_CONVERGENCE",
    stage: "post_pass3",
    description: "Lessons-learned enforcement after convergence output.",
    appliesToExecutionModes: ["TRUSTED_PATH", "STUDIO"],
    authority: "Phase 0.2 Lessons Learned",
    primaryAction: "BLOCK",
    auditEvent: "governance.llr.post_convergence",
    inputShape: ["structural_result", "diagnostic_result", "convergence_result", "registry", "trace_metadata"],
    outputShape: ["lessons_learned_report", "enforcement_decision"],
    downstreamImpact: {
      blocksStages: ["pass4"],
      affectsArtifacts: true,
    },
    blockErrorCode: "LLR_POST_CONVERGENCE_BLOCK",
    llrStage: "post_convergence",
  },
  {
    id: "LLR_PRE_ARTIFACT_GENERATION",
    stage: "pre_pass4",
    description: "Final lessons-learned enforcement before quality gate/artifact boundary.",
    appliesToExecutionModes: ["TRUSTED_PATH", "STUDIO"],
    authority: "Phase 0.2 Lessons Learned",
    primaryAction: "BLOCK",
    auditEvent: "governance.llr.pre_artifact_generation",
    inputShape: ["structural_result", "diagnostic_result", "convergence_result", "registry", "trace_metadata"],
    outputShape: ["lessons_learned_report", "enforcement_decision"],
    downstreamImpact: {
      blocksStages: ["pass4"],
      affectsArtifacts: true,
    },
    blockErrorCode: "LLR_PRE_ARTIFACT_GENERATION_BLOCK",
    llrStage: "pre_artifact_generation",
  },
  {
    id: "ELIGIBILITY_GATE",
    stage: "post_evaluation_envelope",
    description: "Eligibility gate controlling refinement path entry.",
    appliesToExecutionModes: ["TRUSTED_PATH", "STUDIO"],
    authority: "Volume II-A Eligibility Gate",
    primaryAction: "BLOCK",
    auditEvent: "governance.eligibility_gate.checked",
    inputShape: ["evaluation_envelope"],
    outputShape: ["eligibility_gate", "readiness_state"],
    downstreamImpact: {
      blocksStages: ["pass4"],
      affectsArtifacts: true,
    },
    blockErrorCode: "REFINEMENT_BLOCKED_BY_GATE",
  },
  {
    id: "QUALITY_GATE",
    stage: "pass4",
    description: "Deterministic quality gate over synthesized output.",
    appliesToExecutionModes: ["TRUSTED_PATH", "STUDIO"],
    authority: "Phase 2.7 Quality Gate",
    primaryAction: "BLOCK",
    auditEvent: "governance.quality_gate.checked",
    inputShape: ["synthesis", "pass1", "pass2"],
    outputShape: ["quality_gate_result"],
    downstreamImpact: {
      blocksStages: ["pass4"],
      affectsArtifacts: true,
    },
    blockErrorCode: "QG_UNKNOWN",
  },
  {
    id: "HUMAN_REVIEW_BOUNDARY",
    stage: "post_pass4",
    description: "Boundary where human review may intervene before certification.",
    appliesToExecutionModes: ["TRUSTED_PATH", "STUDIO"],
    authority: "Operations Runbook",
    primaryAction: "AUDIT",
    auditEvent: "governance.human_review_boundary.reached",
    inputShape: ["pipeline_result", "quality_gate_result"],
    outputShape: ["review_decision"],
    downstreamImpact: {
      warnsStages: ["pass4"],
      affectsArtifacts: true,
    },
  },
  {
    id: "ARTIFACT_CERTIFICATION_BOUNDARY",
    stage: "artifact_certification",
    description: "Final boundary for artifact certification and publication eligibility.",
    appliesToExecutionModes: ["TRUSTED_PATH", "STUDIO"],
    authority: "docs/JOB_CONTRACT_v1.md",
    primaryAction: "AUDIT",
    auditEvent: "governance.artifact_certification_boundary.reached",
    inputShape: ["pipeline_result", "audit_summary"],
    outputShape: ["certified_artifact"],
    downstreamImpact: {
      affectsArtifacts: true,
    },
  },
  {
    id: "FAILURE_ESCALATION_DEAD_LETTER",
    stage: "failure_path",
    description: "Escalates blocked/failed executions into dead-letter operational handling.",
    appliesToExecutionModes: ["TRUSTED_PATH", "STUDIO"],
    authority: "Operations Runbook",
    primaryAction: "WARN",
    auditEvent: "governance.failure_escalation.dead_letter",
    inputShape: ["error_code", "failed_at", "trace_metadata"],
    outputShape: ["dead_letter_event"],
    downstreamImpact: {
      affectsArtifacts: false,
    },
  },
] as const;

function checkpointToString(checkpoint: GovernanceCheckpoint): string {
  return `${checkpoint.id} @ ${checkpoint.stage}`;
}

export function validateGovernanceInjectionMap(map: GovernanceInjectionMap): void {
  if (!Array.isArray(map) || map.length === 0) {
    throw new Error("Governance injection map is empty");
  }

  const seen = new Set<GovernanceCheckpointId>();
  for (const checkpoint of map) {
    if (seen.has(checkpoint.id)) {
      throw new Error(`Governance injection map contains duplicate checkpoint id: ${checkpoint.id}`);
    }
    seen.add(checkpoint.id);

    if (checkpoint.primaryAction === "BLOCK" && !checkpoint.blockErrorCode) {
      throw new Error(`Governance injection map BLOCK checkpoint missing blockErrorCode: ${checkpointToString(checkpoint)}`);
    }

    if (checkpoint.llrStage && !checkpoint.id.startsWith("LLR_")) {
      throw new Error(`Governance injection map llrStage attached to non-LLR checkpoint: ${checkpointToString(checkpoint)}`);
    }
  }

  for (const requiredId of REQUIRED_GOVERNANCE_CHECKPOINT_IDS) {
    if (!seen.has(requiredId)) {
      throw new Error(`Governance injection map missing required checkpoint: ${requiredId}`);
    }
  }
}

export function loadGovernanceInjectionMap(
  map: GovernanceInjectionMap = DEFAULT_GOVERNANCE_INJECTION_MAP,
): GovernanceInjectionMap {
  validateGovernanceInjectionMap(map);
  return map;
}

export function getGovernanceCheckpointById(
  id: GovernanceCheckpointId,
  map: GovernanceInjectionMap = DEFAULT_GOVERNANCE_INJECTION_MAP,
): GovernanceCheckpoint {
  const checkpoint = map.find((entry) => entry.id === id);
  if (!checkpoint) {
    throw new Error(`Governance checkpoint not found: ${id}`);
  }
  return checkpoint;
}

export function getLlrCheckpointForStage(
  stage: RuleStage,
  map: GovernanceInjectionMap = DEFAULT_GOVERNANCE_INJECTION_MAP,
): GovernanceCheckpoint {
  const checkpoint = map.find((entry) => entry.llrStage === stage);
  if (!checkpoint) {
    throw new Error(`Governance LLR checkpoint not found for stage: ${stage}`);
  }
  return checkpoint;
}
