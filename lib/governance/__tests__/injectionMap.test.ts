import { describe, expect, it } from "@jest/globals";
import {
  DEFAULT_GOVERNANCE_INJECTION_MAP,
  REQUIRED_GOVERNANCE_CHECKPOINT_IDS,
  getGovernanceCheckpointById,
  getLlrCheckpointForStage,
  loadGovernanceInjectionMap,
  validateGovernanceInjectionMap,
} from "@/lib/governance/injectionMap";

describe("governance injection map", () => {
  it("loads the default map and includes all required checkpoints", () => {
    const map = loadGovernanceInjectionMap();
    const ids = new Set(map.map((entry) => entry.id));

    for (const requiredId of REQUIRED_GOVERNANCE_CHECKPOINT_IDS) {
      expect(ids.has(requiredId)).toBe(true);
    }
  });

  it("rejects duplicate checkpoint ids", () => {
    const duplicate = [
      ...DEFAULT_GOVERNANCE_INJECTION_MAP,
      { ...DEFAULT_GOVERNANCE_INJECTION_MAP[0] },
    ] as const;

    expect(() => validateGovernanceInjectionMap(duplicate)).toThrow(
      "duplicate checkpoint id",
    );
  });

  it("rejects missing required checkpoints", () => {
    const withoutQualityGate = DEFAULT_GOVERNANCE_INJECTION_MAP.filter(
      (entry) => entry.id !== "QUALITY_GATE",
    );

    expect(() => validateGovernanceInjectionMap(withoutQualityGate)).toThrow(
      "missing required checkpoint: QUALITY_GATE",
    );
  });

  it("maps each LLR stage to the correct checkpoint", () => {
    expect(getLlrCheckpointForStage("post_structural").id).toBe("LLR_POST_STRUCTURAL");
    expect(getLlrCheckpointForStage("post_diagnostic").id).toBe("LLR_POST_DIAGNOSTIC");
    expect(getLlrCheckpointForStage("post_convergence").id).toBe("LLR_POST_CONVERGENCE");
    expect(getLlrCheckpointForStage("pre_artifact_generation").id).toBe("LLR_PRE_ARTIFACT_GENERATION");
  });

  it("exposes canonical checkpoint metadata for pipeline binding", () => {
    const checkpoint = getGovernanceCheckpointById("CANON_REGISTRY_BINDING");

    expect(checkpoint.primaryAction).toBe("BLOCK");
    expect(checkpoint.blockErrorCode).toBe("CANON_REGISTRY_BIND_FAILED");
    expect(checkpoint.authority).toBeDefined();
  });
});
