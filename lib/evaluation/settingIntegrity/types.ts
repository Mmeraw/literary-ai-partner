/**
 * Setting Integrity Audit — Type Contracts
 *
 * PR-A: Schema foundation for the Setting Integrity Audit module.
 *
 * Governance contract (Five Governance Rules — binding):
 *   1. NEVER contaminate the 13-criterion story score.
 *   2. NEVER block the quality gate.
 *   3. All output is advisory and confidence-banded.
 *   4. Every alert is dismissible per-item by the author.
 *   5. Declared setting context (author-provided) narrows the check universe.
 *
 * Cardinal product rule:
 *   "This may require verification" — NEVER "This is wrong."
 *
 * This is a paid add-on module. Access is gated in PR-D.
 * The report UI panel is built in PR-C.
 * External API integrations (eBird, GBIF, Wikidata) are added in PR-B.
 */

// ── Claim taxonomy ────────────────────────────────────────────────────────────

/**
 * The category of real-world claim being evaluated.
 *
 * ecology_species  → birds, plants, fish, insects, animals — regional/seasonal plausibility
 * geography        → towns, rivers, roads, distances, travel times
 * historical_period → technologies, tools, materials, events — era plausibility
 * biology_anatomy  → species anatomy, behaviour, physiology
 * technology_vehicle → car models, appliances, materials — production year alignment
 * continuity       → cross-chapter state changes (road surface, prop, tech)
 */
export type ClaimCategory =
  | 'ecology_species'
  | 'geography'
  | 'historical_period'
  | 'biology_anatomy'
  | 'technology_vehicle'
  | 'continuity';

// ── Verification tiers ────────────────────────────────────────────────────────

/**
 * Which verification layer produced this result.
 *
 * Tier 1 — Wikidata SPARQL:       High confidence, cite source
 * Tier 2 — Domain knowledge pack: Medium confidence, cite pack version
 * Tier 3 — LLM grounded prompt:   Low confidence, always "needs review"
 * Tier 4 — No data found:         Unverifiable by system, flag for manual check
 */
export type VerificationTier = 'wikidata' | 'knowledge_pack' | 'llm_fallback' | 'unverifiable';

// ── Confidence ────────────────────────────────────────────────────────────────

/** Author-visible confidence label on each alert */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

// ── Verification status ───────────────────────────────────────────────────────

/**
 * The plausibility verdict for a single claim.
 *
 * supported              → reference data supports the claim; no alert needed
 * unsupported            → reference data contradicts the claim; alert generated
 * ambiguous              → data exists but is inconclusive
 * needs_human_review     → LLM or unverifiable tier; alert generated with low confidence
 */
export type VerificationStatus =
  | 'supported'
  | 'unsupported'
  | 'ambiguous'
  | 'needs_human_review';

// ── Manuscript context ────────────────────────────────────────────────────────

/**
 * Author-declared setting context — narrows the verification universe.
 * Passed at job submission time; stored with the audit artifact.
 *
 * All fields are optional — the audit degrades gracefully with partial context.
 */
export type ManuscriptSettingContext = {
  /** E.g. 'British Columbia, Canada' */
  region?: string;
  /** E.g. '1973' or '44,000 BP' or 'Victorian England' */
  era?: string;
  /** ISO season: 'spring' | 'summer' | 'autumn' | 'winter' */
  season?: string;
  /** Free-form notes from the author */
  notes?: string;
};

// ── Individual claim ──────────────────────────────────────────────────────────

/**
 * A single verifiable real-world claim extracted from the manuscript.
 * This is the atomic unit of the Setting Integrity Audit.
 */
export type WorldDetailClaim = {
  /** Stable unique ID for this claim within the audit */
  claim_id: string;

  /** Verbatim passage from manuscript (max 400 chars) */
  text_span: string;

  /** The entity being claimed (e.g. 'Steller\'s Jay', '1973 Datsun 510') */
  entity: string;

  /** Claim category */
  category: ClaimCategory;

  /** Claimed location or region (if applicable) */
  location?: string;

  /** Claimed time period or era (if applicable) */
  time_period?: string;

  /** Season context (if applicable) */
  season?: string;

  /** Which verification tier produced this result */
  verification_tier: VerificationTier;

  /** Plausibility verdict */
  verification_status: VerificationStatus;

  /**
   * 0–1 float. Combined from tier weight + source agreement.
   * Used to compute ConfidenceLevel for display.
   */
  confidence_score: number;

  /** Author-visible confidence label (derived from confidence_score) */
  confidence_level: ConfidenceLevel;

  /**
   * The author-facing alert message.
   * Must follow cardinal rule: "may require verification", never "is wrong".
   * Max 280 chars.
   */
  report_message: string;

  /**
   * Practical suggestion for the author.
   * E.g. 'Consider replacing with Steller\'s Jay or Varied Thrush, both common in BC cedar forests.'
   * Null if no suggestion is available.
   */
  suggestion: string | null;

  /**
   * Reference sources consulted.
   * E.g. ['eBird occurrence data', 'Wikidata Q135460']
   */
  sources_checked: string[];

  /** Whether the author has dismissed this alert in the UI */
  dismissed: boolean;
};

// ── Audit result ──────────────────────────────────────────────────────────────

/**
 * The complete result of one Setting Integrity Audit run.
 * Stored in evaluation_artifacts as artifact_type='setting_integrity_audit_v1'.
 */
export type SettingIntegrityAudit = {
  /** Artifact schema version */
  schema_version: 'setting_integrity_audit_v1';

  /** Source evaluation job */
  job_id: string;

  /** Manuscript identity */
  manuscript_id: number;

  /** UTC ISO timestamp of audit creation */
  captured_at: string;

  /** Author-declared setting context provided at submission */
  setting_context: ManuscriptSettingContext;

  /** All claims extracted (includes supported + alerted) */
  all_claims: WorldDetailClaim[];

  /**
   * Subset of all_claims where verification_status !== 'supported'.
   * These are the author-facing alerts.
   */
  alerts: WorldDetailClaim[];

  /** Total claims extracted */
  total_claims_extracted: number;

  /** Total alerts generated */
  total_alerts: number;

  /**
   * Governance enforcement record.
   * Immutable at write time — cannot be overridden by downstream consumers.
   */
  governance: {
    /** Always false — alerts NEVER affect literary scores */
    factual_alerts_affect_scores: false;
    /** Always false — alerts NEVER block the quality gate */
    factual_alerts_block_gate: false;
    /** The cardinal rule, stored verbatim for auditability */
    cardinal_rule: 'This may require verification — never This is wrong';
  };
};

// ── Artifact content wrapper ──────────────────────────────────────────────────

/** Shape stored in evaluation_artifacts.content for artifact_type='setting_integrity_audit_v1' */
export type SettingIntegrityAuditArtifactContent = {
  schema_version: 'setting_integrity_audit_v1';
  created_at: string;
  job_id: string;
  manuscript_id: number;
  setting_integrity_audit: SettingIntegrityAudit;
};

// ── Entitlement guard ─────────────────────────────────────────────────────────

/**
 * Access gate for the Setting Integrity Audit (paid add-on).
 * Evaluated in PR-D governance enforcement.
 * Stored alongside the job or user profile — TBD in PR-D.
 */
export type SettingIntegrityEntitlement = {
  /** Whether this user/subscription has access to the SIA module */
  enabled: boolean;

  /** Entitlement source — for auditability */
  source: 'subscription' | 'trial' | 'admin_grant';

  /** UTC ISO expiry, null = perpetual */
  expires_at: string | null;
};
