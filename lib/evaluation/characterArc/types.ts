/**
 * Character Arc Ledger — Type Contracts
 *
 * PR-578: Schema foundation for the Character Coverage & Arc Ledger.
 *
 * Governance contract:
 *   - The ledger is a REPORT QA LAYER, not a craft criterion.
 *   - Gate results NEVER mutate the 13-criterion story score.
 *   - Gate hard-fails trigger report re-render; they do NOT fail the evaluation job.
 *   - This module is invisible to end users — they see a thorough report, not QA machinery.
 *
 * Downstream consumers (not yet built):
 *   - PR-579: characterArcWorker (extraction + ledger population)
 *   - PR-580: report renderer (ledger-aware character coverage block)
 *   - PR-581: gate enforcement (hard/soft fail logic + re-render trigger)
 */

// ── Narrative weight ──────────────────────────────────────────────────────────

/**
 * How much structural / emotional load a character carries.
 * Used by the gate to determine omission severity.
 *
 * primary     → protagonist / co-protagonist (hard-fail if omitted)
 * major       → load-bearing supporting character (hard-fail if omitted from ending analysis)
 * supporting  → named, recurring, meaningfully developed
 * recurring   → appears multiple times, limited arc
 * minor       → cameo / functional / named once
 */
export type NarrativeWeightBand =
  | 'primary'
  | 'major'
  | 'supporting'
  | 'recurring'
  | 'minor';

// ── Arc state ─────────────────────────────────────────────────────────────────

/**
 * The four-beat arc movement model.
 * All fields are nullable — extraction worker fills what the manuscript supports.
 * A null turn or end flags a potential arc incompleteness for soft-fail review.
 */
export type ArcMovement = {
  /** Where the character is at story open */
  start: string | null;
  /** The event / relationship / internal force that changes them */
  pressure: string | null;
  /** The moment of change / decision / revelation */
  turn: string | null;
  /** Resolved state at story close */
  end: string | null;
};

// ── Ending states ─────────────────────────────────────────────────────────────

/**
 * The character's narrative arc conclusion — separated from report acknowledgement.
 *
 * resolved   → arc has a clear close (positive or tragic)
 * open       → arc is intentionally unresolved (series, ambiguity)
 * absent     → character disappears before narrative close without explanation
 * ambiguous  → evidence is insufficient to classify
 */
export type ArcEndingStatus = 'resolved' | 'open' | 'absent' | 'ambiguous';

/**
 * Whether the rendered evaluation report accounts for this character.
 *
 * Separated from ArcEndingStatus so the gate can distinguish:
 *   - "the character's arc is open" (valid literary choice)
 *   - "the report never mentioned the character" (report failure)
 */
export type ReportAcknowledgementStatus =
  | 'discussed'     // substantively covered in the report
  | 'mentioned'     // named in passing, not analysed
  | 'omitted'       // absent from the rendered report
  | 'contradicted'; // report contradicts manuscript evidence (e.g. pronoun mismatch)

// ── Character entry ───────────────────────────────────────────────────────────

export type CharacterArcEntry = {
  /** Stable identifier — snake_case of canonical name */
  character_id: string;

  /** Canonical name as used in manuscript */
  name: string;

  /** Pronouns observed in manuscript (e.g. ['she', 'her']) */
  pronouns: string[];

  /** Structural load band — determines gate severity on omission */
  narrative_weight_band: NarrativeWeightBand;

  /** Four-beat arc movement — null fields = gap in manuscript evidence */
  arc_movement: ArcMovement | null;

  /**
   * Broad arc classification (e.g. 'redemptive', 'tragic', 'coming_of_age', 'static').
   * Null = extraction was inconclusive.
   * Soft-fail if null for primary/major characters.
   */
  arc_classification: string | null;

  /** How this character's arc resolves in the story */
  ending_status: ArcEndingStatus;

  /** Whether the rendered report accounts for this character */
  report_acknowledgement_status: ReportAcknowledgementStatus;

  /**
   * Named relational engines this character anchors.
   * E.g. ['Hyla-Zimeon', 'Rana-Newton'].
   * Tracked separately so the gate enforces relationship engine coverage.
   */
  relational_engines: string[];

  /**
   * Raw text evidence snippets supporting the extraction.
   * Stored for auditability — not surfaced to end users.
   * Max 5 snippets, each <= 300 chars.
   */
  evidence_snippets: string[];
};

// ── Relational engine ─────────────────────────────────────────────────────────

/**
 * A dyadic or group relationship that carries reader attachment weight.
 * Tracked separately from individual arcs because a report can correctly
 * cover each individual yet miss the relationship system that gives the
 * manuscript its emotional spine.
 */
export type RelationalEngine = {
  /** Key matching the relational_engines strings on CharacterArcEntry */
  engine_id: string;

  /** Display name (e.g. 'Rana and Newton') */
  label: string;

  /** Characters in this relationship (character_ids) */
  character_ids: string[];

  /**
   * How important this relationship is to the story's emotional payload.
   * dominant    = primary emotional spine; hard-fail if omitted from report
   * significant = meaningful but secondary; soft-fail if omitted
   * contextual  = colour / texture; no gate trigger
   */
  weight: 'dominant' | 'significant' | 'contextual';

  /** Whether the rendered report addresses this relationship engine */
  report_coverage: 'covered' | 'mentioned' | 'omitted';
};

// ── Gate result ───────────────────────────────────────────────────────────────

export type ArcGateVerdict = 'pass' | 'soft_fail' | 'hard_fail';

/**
 * Hard-fail conditions (governance brief — binding).
 * A single hard-fail fires the gate.
 */
export type HardFailReason =
  | 'PROTAGONIST_MISSING_FROM_LEDGER'
  | 'CO_PROTAGONIST_OMITTED_FROM_REPORT'
  | 'MAJOR_COMPANION_OMITTED_OR_UNDERWEIGHTED'
  | 'MAJOR_CHARACTER_NO_ARC_STATE'
  | 'MAJOR_CHARACTER_NO_ENDING_ACCOUNTABILITY'
  | 'PRONOUN_CONTRADICTION_MAJOR_CHARACTER';

/**
 * Soft-fail conditions.
 * Accumulated; do not trigger re-render unless configured to do so.
 */
export type SoftFailReason =
  | 'MAJOR_CHARACTER_PRESENT_BUT_UNDERWEIGHTED'
  | 'DOMINANT_RELATIONAL_ENGINE_UNDERWEIGHTED'
  | 'ENDING_ACCOUNTABILITY_WARNINGS_UNRESOLVED'
  | 'LEDGER_REPORT_EMPHASIS_DIVERGENCE';

// ── Ledger artifact ───────────────────────────────────────────────────────────

/**
 * The canonical character arc ledger artifact.
 * Stored in evaluation_artifacts as artifact_type='character_arc_ledger_v1'.
 *
 * Output of PR-579 (extraction worker).
 * Input to PR-580 (report renderer) and PR-581 (gate enforcement).
 */
export type CharacterArcLedger = {
  /** Artifact schema version */
  schema_version: 'character_arc_ledger_v1';

  /** Source evaluation job */
  job_id: string;

  /** Manuscript identity */
  manuscript_id: number;

  /** UTC ISO timestamp of ledger creation */
  captured_at: string;

  /** All characters extracted from the manuscript */
  characters: CharacterArcEntry[];

  /** All relational engines identified */
  relational_engines: RelationalEngine[];

  /** Gate verdict for this ledger */
  gate_result: ArcGateVerdict;

  /** Hard-fail reasons — empty array if gate_result !== 'hard_fail' */
  hard_fail_reasons: HardFailReason[];

  /** Soft-fail reasons — may be non-empty even when gate_result === 'pass' */
  soft_fail_reasons: SoftFailReason[];

  /**
   * Whether the report was re-rendered as a result of this gate verdict.
   * Set by PR-581 gate enforcement after re-render completes.
   * null = gate has not yet attempted re-render.
   */
  report_rerendered: boolean | null;
};

// ── Artifact content wrapper ──────────────────────────────────────────────────

/** Shape stored in evaluation_artifacts.content for artifact_type='character_arc_ledger_v1' */
export type CharacterArcLedgerArtifactContent = {
  schema_version: 'character_arc_ledger_v1';
  created_at: string;
  job_id: string;
  manuscript_id: number;
  character_arc_ledger: CharacterArcLedger;
};
