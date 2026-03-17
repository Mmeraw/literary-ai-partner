/**
 * Canon Doctrine Registry — single source of truth for enforceable rules.
 *
 * Each registry entry represents an ACTIVE canon that governance logic may enforce.
 * DO NOT invent Canon IDs. All IDs must map to real canon documents.
 *
 * Status values:
 * - ACTIVE: canon is in force and enforceable
 * - ARCHIVED: canon is no longer in effect (legacy reference only)
 * - REPEALED: canon was explicitly revoked
 */

export type CanonStatus = "ACTIVE" | "ARCHIVED" | "REPEALED";

export type CanonType =
  | "CORE"
  | "GOVERNANCE"
  | "EXECUTION"
  | "IMPLEMENTATION"
  | "NARRATIVE_INTELLIGENCE";

export interface CanonRegistryEntry {
  canonId: string;
  name: string;
  type: CanonType;
  status: CanonStatus;
  sourceDocument: string;
  destination: string;
  addedAt?: string;
}

/**
 * The canonical registry of enforceable doctrines.
 *
 * This is the static source of truth for which rules may be enforced at runtime.
 * Entries are immutable after initialization.
 */
const CANON_REGISTRY: Map<string, CanonRegistryEntry> = new Map([
  [
    "CRIT-CONCEPT-001",
    {
      canonId: "CRIT-CONCEPT-001",
      name: "13-Criteria Concept Integrity",
      type: "CORE",
      status: "ACTIVE",
      sourceDocument: "Volume II — 13 Story Criteria Canon",
      destination: "evaluation_artifacts > distribution > criteria",
      addedAt: "2026-01-15",
    },
  ],
  [
    "CRIT-MOMENTUM-001",
    {
      canonId: "CRIT-MOMENTUM-001",
      name: "13-Criteria Narrative Momentum",
      type: "CORE",
      status: "ACTIVE",
      sourceDocument: "Volume II — 13 Story Criteria Canon",
      destination: "evaluation_artifacts > distribution > criteria",
      addedAt: "2026-01-15",
    },
  ],
  [
    "CRIT-CHARACTER-001",
    {
      canonId: "CRIT-CHARACTER-001",
      name: "13-Criteria Character Development",
      type: "CORE",
      status: "ACTIVE",
      sourceDocument: "Volume II — 13 Story Criteria Canon",
      destination: "evaluation_artifacts > distribution > criteria",
      addedAt: "2026-01-15",
    },
  ],
  [
    "CRIT-POVVOICE-001",
    {
      canonId: "CRIT-POVVOICE-001",
      name: "13-Criteria POV and Voice",
      type: "CORE",
      status: "ACTIVE",
      sourceDocument: "Volume II — 13 Story Criteria Canon",
      destination: "evaluation_artifacts > distribution > criteria",
      addedAt: "2026-01-15",
    },
  ],
  [
    "CRIT-SCENE-001",
    {
      canonId: "CRIT-SCENE-001",
      name: "13-Criteria Scene Structure",
      type: "CORE",
      status: "ACTIVE",
      sourceDocument: "Volume II — 13 Story Criteria Canon",
      destination: "evaluation_artifacts > distribution > criteria",
      addedAt: "2026-01-15",
    },
  ],
  [
    "CRIT-DIALOGUE-001",
    {
      canonId: "CRIT-DIALOGUE-001",
      name: "13-Criteria Dialogue Quality",
      type: "CORE",
      status: "ACTIVE",
      sourceDocument: "Volume II — 13 Story Criteria Canon",
      destination: "evaluation_artifacts > distribution > criteria",
      addedAt: "2026-01-15",
    },
  ],
  [
    "CRIT-THEME-001",
    {
      canonId: "CRIT-THEME-001",
      name: "13-Criteria Thematic Coherence",
      type: "CORE",
      status: "ACTIVE",
      sourceDocument: "Volume II — 13 Story Criteria Canon",
      destination: "evaluation_artifacts > distribution > criteria",
      addedAt: "2026-01-15",
    },
  ],
  [
    "CRIT-WORLD-001",
    {
      canonId: "CRIT-WORLD-001",
      name: "13-Criteria World-Building",
      type: "CORE",
      status: "ACTIVE",
      sourceDocument: "Volume II — 13 Story Criteria Canon",
      destination: "evaluation_artifacts > distribution > criteria",
      addedAt: "2026-01-15",
    },
  ],
  [
    "CRIT-PACING-001",
    {
      canonId: "CRIT-PACING-001",
      name: "13-Criteria Narrative Pacing",
      type: "CORE",
      status: "ACTIVE",
      sourceDocument: "Volume II — 13 Story Criteria Canon",
      destination: "evaluation_artifacts > distribution > criteria",
      addedAt: "2026-01-15",
    },
  ],
  [
    "CRIT-PROSE-001",
    {
      canonId: "CRIT-PROSE-001",
      name: "13-Criteria Prose Quality",
      type: "CORE",
      status: "ACTIVE",
      sourceDocument: "Volume II — 13 Story Criteria Canon",
      destination: "evaluation_artifacts > distribution > criteria",
      addedAt: "2026-01-15",
    },
  ],
  [
    "CRIT-TONE-001",
    {
      canonId: "CRIT-TONE-001",
      name: "13-Criteria Tonal Consistency",
      type: "CORE",
      status: "ACTIVE",
      sourceDocument: "Volume II — 13 Story Criteria Canon",
      destination: "evaluation_artifacts > distribution > criteria",
      addedAt: "2026-01-15",
    },
  ],
  [
    "CRIT-CLOSURE-001",
    {
      canonId: "CRIT-CLOSURE-001",
      name: "13-Criteria Ending Quality",
      type: "CORE",
      status: "ACTIVE",
      sourceDocument: "Volume II — 13 Story Criteria Canon",
      destination: "evaluation_artifacts > distribution > criteria",
      addedAt: "2026-01-15",
    },
  ],
  [
    "CRIT-MARKET-001",
    {
      canonId: "CRIT-MARKET-001",
      name: "13-Criteria Market Viability",
      type: "CORE",
      status: "ACTIVE",
      sourceDocument: "Volume II — 13 Story Criteria Canon",
      destination: "evaluation_artifacts > distribution > criteria",
      addedAt: "2026-01-15",
    },
  ],
  [
    "GATE-ELIGIBILITY-002",
    {
      canonId: "GATE-ELIGIBILITY-002",
      name: "Volume II-A Eligibility Gate Enforcement",
      type: "GOVERNANCE",
      status: "ACTIVE",
      sourceDocument: "Volume II-A — Operational Schema",
      destination: "governance > eligibility_gate",
      addedAt: "2026-02-01",
    },
  ],
  [
    "ENV-EVAL-ARTIFACT-001",
    {
      canonId: "ENV-EVAL-ARTIFACT-001",
      name: "Evaluation Artifact Schema (13-Criteria Envelope)",
      type: "EXECUTION",
      status: "ACTIVE",
      sourceDocument: "Volume II-A — Operational Schema",
      destination: "evaluation_artifacts > schema",
      addedAt: "2026-01-20",
    },
  ],
  [
    "REFINEMENT-GATE-001",
    {
      canonId: "REFINEMENT-GATE-001",
      name: "Refinement Path Eligibility Gating",
      type: "GOVERNANCE",
      status: "ACTIVE",
      sourceDocument: "Volume II-A — Operational Schema",
      destination: "refine > eligibility_check",
      addedAt: "2026-02-01",
    },
  ],
]);

/**
 * Check if a canon is registered and ACTIVE.
 */
export function isCanonActive(canonId: string): boolean {
  const entry = CANON_REGISTRY.get(canonId);
  return entry !== undefined && entry.status === "ACTIVE";
}

/**
 * Assert that a canon is registered and ACTIVE.
 * Throws GovernanceError if not.
 */
export function assertCanonActive(canonId: string): void {
  const entry = CANON_REGISTRY.get(canonId);
  if (!entry) {
    const { GovernanceError } = require("./errors");
    throw new GovernanceError(
      `Canon ID not found in registry: ${canonId}`,
      "CANON_NOT_FOUND",
      { canonId },
    );
  }
  if (entry.status !== "ACTIVE") {
    const { GovernanceError } = require("./errors");
    throw new GovernanceError(
      `Canon is not ACTIVE: ${canonId} (status: ${entry.status})`,
      "CANON_INACTIVE",
      { canonId, status: entry.status },
    );
  }
}

/**
 * Get a registry entry by Canon ID.
 */
export function getCanonEntry(canonId: string): CanonRegistryEntry | undefined {
  return CANON_REGISTRY.get(canonId);
}

/**
 * List all ACTIVE canon entries.
 */
export function listActiveCanons(): CanonRegistryEntry[] {
  return Array.from(CANON_REGISTRY.values()).filter((entry) => entry.status === "ACTIVE");
}

/**
 * Freeze the registry to prevent runtime mutations.
 */
export function freezeRegistry(): void {
  Object.freeze(CANON_REGISTRY);
}

// Freeze on module load
freezeRegistry();
