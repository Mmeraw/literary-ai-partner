/**
 * Internal Governance Mapping Layer — canon enforcement IDs for this codebase.
 *
 * @registry-source docs/NOMENCLATURE_CANON_v1.md
 * Verified by scripts/verify-canon-ids.ts on 2026-03-23.
 * Verification result: 16/16 entries matched (13 criteria-linked + 3 non-criteria canon IDs).
 *
 * Status values:
 * - ACTIVE: canon is in force and enforceable
 * - ARCHIVED: canon is no longer in effect (legacy reference only)
 * - REPEALED: canon was explicitly revoked
 */

import { GovernanceError } from "./errors";

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

type MutableCanonRegistry = Map<string, CanonRegistryEntry>;

function createReadonlyMapFacade<K, V>(source: Map<K, V>): ReadonlyMap<K, V> {
  return Object.freeze({
    get size() {
      return source.size;
    },
    has: source.has.bind(source),
    get: source.get.bind(source),
    entries: source.entries.bind(source),
    keys: source.keys.bind(source),
    values: source.values.bind(source),
    forEach: source.forEach.bind(source),
    [Symbol.iterator]: source[Symbol.iterator].bind(source),
  }) as ReadonlyMap<K, V>;
}

/**
 * The canonical registry of enforceable doctrines.
 *
 * This is the static source of truth for which rules may be enforced at runtime.
 * Entries are immutable after initialization.
 */
const CANON_REGISTRY_INTERNAL: MutableCanonRegistry = new Map([
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

  [
    "WAVE-31-LW",
    {
      canonId: "WAVE-31-LW",
      name: "Chapter-Ending Pressure Doctrine",
      type: "GOVERNANCE",
      status: "ACTIVE",
      sourceDocument: "Lost World Lessons Doctrine Addendum",
      destination: "chapter-ending-analyzer, wave planner ending pressure gates",
      addedAt: "2026-04-10",
    },
  ],
  [
    "WAVE-55-L",
    {
      canonId: "WAVE-55-L",
      name: "Selective Authority Compression Doctrine",
      type: "GOVERNANCE",
      status: "ACTIVE",
      sourceDocument: "Lost World Lessons Doctrine Addendum",
      destination: "diff-intelligence, ritual-protection, wave safety matrix",
      addedAt: "2026-04-10",
    },
  ],
  [
    "RITUAL-EDITOR-1",
    {
      canonId: "RITUAL-EDITOR-1",
      name: "Ritual Arbitration Doctrine",
      type: "GOVERNANCE",
      status: "ACTIVE",
      sourceDocument: "Lost World Lessons Doctrine Addendum",
      destination: "REC-1A logic, escalation-analyzer",
      addedAt: "2026-04-10",
    },
  ],
  [
    "VOICE-LAW-1",
    {
      canonId: "VOICE-LAW-1",
      name: "Voice Ownership Doctrine",
      type: "GOVERNANCE",
      status: "ACTIVE",
      sourceDocument: "Lost World Lessons Doctrine Addendum",
      destination: "voice-mode-analyzer, voice-drift",
      addedAt: "2026-04-10",
    },
  ],
  [
    "ANCHOR-LAW-1",
    {
      canonId: "ANCHOR-LAW-1",
      name: "Anchor Line Protection Doctrine",
      type: "GOVERNANCE",
      status: "ACTIVE",
      sourceDocument: "Lost World Lessons Doctrine Addendum",
      destination: "anchor-lock, author-intent",
      addedAt: "2026-04-10",
    },
  ],
  [
    "JUDGMENT-LAW-1",
    {
      canonId: "JUDGMENT-LAW-1",
      name: "System Judgment Doctrine",
      type: "GOVERNANCE",
      status: "ACTIVE",
      sourceDocument: "Lost World Lessons Doctrine Addendum",
      destination: "revision-orchestrator, diff-intelligence",
      addedAt: "2026-04-10",
    },
  ],
]);

export type CanonRegistry = ReadonlyMap<string, CanonRegistryEntry>;
export const CANON_REGISTRY: CanonRegistry = createReadonlyMapFacade(CANON_REGISTRY_INTERNAL);

/**
 * Phase 0.1 — validate canonical registry at runtime.
 *
 * Fail-closed rule: any structural integrity defect throws.
 */
export function validateCanonicalRegistry(): void {
  if (CANON_REGISTRY_INTERNAL.size === 0) {
    throw new Error("Canonical registry is empty — fail-closed");
  }

  const seen = new Set<string>();
  for (const [key, entry] of CANON_REGISTRY_INTERNAL.entries()) {
    if (seen.has(key)) {
      throw new Error(`Duplicate Canon ID detected: ${key}`);
    }
    seen.add(key);

    if (!entry.canonId || entry.canonId.trim() === "") {
      throw new Error(`Missing canonId for registry key: ${key}`);
    }

    if (entry.canonId !== key) {
      throw new Error(`Registry key / canonId mismatch: key=${key}, canonId=${entry.canonId}`);
    }

    if (!entry.name || entry.name.trim() === "") {
      throw new Error(`Missing name for Canon ID: ${key}`);
    }

    if (!entry.type) {
      throw new Error(`Missing type for Canon ID: ${key}`);
    }

    if (!entry.status) {
      throw new Error(`Missing status for Canon ID: ${key}`);
    }

    if (!entry.sourceDocument || entry.sourceDocument.trim() === "") {
      throw new Error(`Missing sourceDocument for Canon ID: ${key}`);
    }

    if (!entry.destination || entry.destination.trim() === "") {
      throw new Error(`Missing destination for Canon ID: ${key}`);
    }
  }
}

/**
 * Phase 0.1 runtime loader for canonical registry binding.
 */
export function loadCanonicalRegistry(): CanonRegistry {
  return CANON_REGISTRY;
}

/**
 * Check if a canon is registered and ACTIVE.
 */
export function isCanonActive(canonId: string): boolean {
  const entry = CANON_REGISTRY_INTERNAL.get(canonId);
  return entry !== undefined && entry.status === "ACTIVE";
}

/**
 * Assert that a canon is registered and ACTIVE.
 * Throws GovernanceError if not.
 */
export function assertCanonActive(canonId: string): void {
  const entry = CANON_REGISTRY_INTERNAL.get(canonId);
  if (!entry) {
// GovernanceError imported at top of file
    throw new GovernanceError(
      `Canon ID not found in registry: ${canonId}`,
      "CANON_NOT_FOUND",
      { canonId },
    );
  }
  if (entry.status !== "ACTIVE") {
// GovernanceError imported at top of file
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
  return CANON_REGISTRY_INTERNAL.get(canonId);
}

/**
 * List all ACTIVE canon entries.
 */
export function listActiveCanons(): CanonRegistryEntry[] {
  return Array.from(CANON_REGISTRY_INTERNAL.values()).filter((entry) => entry.status === "ACTIVE");
}

/**
 * Freeze the registry to prevent runtime mutations.
 */
export function freezeRegistry(): void {
  for (const entry of CANON_REGISTRY_INTERNAL.values()) {
    Object.freeze(entry);
  }
}

// Validate then freeze on module load (fail-closed boot behavior)
validateCanonicalRegistry();
freezeRegistry();
