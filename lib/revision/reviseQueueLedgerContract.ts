export type ReviseQueueLedgerColumnKey =
  | 'index'
  | 'severity'
  | 'scope'
  | 'chapter'
  | 'criterion'
  | 'issue'
  | 'options'
  | 'status';

export type RevisionDecisionLedgerColumnKey =
  | 'decision'
  | 'option'
  | 'criterion'
  | 'opportunity'
  | 'sync';

export type ReviseLedgerMetricKey =
  | 'total_opportunities'
  | 'ready_for_revise'
  | 'needs_targeting'
  | 'ready_rate'
  | 'severity_totals'
  | 'scope_totals'
  | 'criteria_totals'
  | 'candidate_option_coverage'
  | 'anchor_coverage'
  | 'ledger_backing_coverage'
  | 'author_decision_count'
  | 'synced_decision_count';

export type ReviseQueueLedgerColumnDefinition = {
  key: ReviseQueueLedgerColumnKey;
  label: string;
  definition: string;
  requiredInputs: string[];
  requiredOutputs: string[];
  inputMetrics: ReviseLedgerMetricKey[];
  outputMetrics: ReviseLedgerMetricKey[];
  failClosedRule: string;
};

export type RevisionDecisionLedgerColumnDefinition = {
  key: RevisionDecisionLedgerColumnKey;
  label: string;
  definition: string;
  requiredInputs: string[];
  requiredOutputs: string[];
  inputMetrics: ReviseLedgerMetricKey[];
  outputMetrics: ReviseLedgerMetricKey[];
  failClosedRule: string;
};

export const REVISE_QUEUE_LEDGER_LIMITS = {
  shortFormMaxOpportunities: 50,
  longFormMaxOpportunities: 100,
  longFormWordThreshold: 25_000,
} as const;

export const REVISE_QUEUE_LEDGER_INPUT_METRICS: Record<ReviseLedgerMetricKey, string> = {
  total_opportunities: 'Total ledger-backed opportunities admitted into Revise Queue plus Needs Targeting.',
  ready_for_revise: 'Count of ledger-backed opportunities passing the Revise card contract.',
  needs_targeting: 'Count of ledger-backed opportunities kicked back because required target/candidate/evidence data is incomplete.',
  ready_rate: 'ready_for_revise divided by total_opportunities; passive observability only.',
  severity_totals: 'Counts by must/should/could severity from revision_opportunity_ledger_v1.',
  scope_totals: 'Counts by Line/Passage/Scene/Chapter/Structural/Manuscript scope.',
  criteria_totals: 'Counts by canonical evaluation criterion.',
  candidate_option_coverage: 'Share of opportunities with valid A/B/C candidate manuscript prose where Ready is expected.',
  anchor_coverage: 'Share of opportunities with exact evidence anchor or justified manuscript-wide support.',
  ledger_backing_coverage: 'Share of rendered opportunities sourced from revision_opportunity_ledger_v1, not re-diagnosed in Revise.',
  author_decision_count: 'Count of persisted or locally staged author decisions.',
  synced_decision_count: 'Count of author decisions confirmed synced to the server ledger.',
};

export const REVISE_QUEUE_LEDGER_COLUMNS: readonly ReviseQueueLedgerColumnDefinition[] = [
  {
    key: 'index',
    label: '#',
    definition: 'Author-facing display order after deterministic severity-ranked queue admission and hard-cap trimming.',
    requiredInputs: ['opportunity_id', 'severity', 'queue admission order'],
    requiredOutputs: ['stable 1-based visible row number'],
    inputMetrics: ['total_opportunities'],
    outputMetrics: ['total_opportunities'],
    failClosedRule: 'If no ledger-backed opportunity exists, render no row.',
  },
  {
    key: 'severity',
    label: 'Severity',
    definition: 'Priority band for author attention: must, should, or could.',
    requiredInputs: ['severity'],
    requiredOutputs: ['Recommended/Optional/Consider display label'],
    inputMetrics: ['severity_totals'],
    outputMetrics: ['severity_totals'],
    failClosedRule: 'Unknown severity must normalize to a canonical band before rendering.',
  },
  {
    key: 'scope',
    label: 'Scope',
    definition: 'Revision blast-radius classification for the opportunity.',
    requiredInputs: ['scope derived from evidence anchor, operation, or evaluation finding'],
    requiredOutputs: ['Line/Passage/Scene/Chapter/Structural/Manuscript display value'],
    inputMetrics: ['scope_totals'],
    outputMetrics: ['scope_totals'],
    failClosedRule: 'Unclassifiable scope must not promote an item to Ready without targeting proof.',
  },
  {
    key: 'chapter',
    label: 'Chapter',
    definition: 'Human-readable chapter locator derived from the manuscript evidence anchor when present.',
    requiredInputs: ['evidence_anchor', 'manuscript_coordinates', 'anchor'],
    requiredOutputs: ['chapter label or em dash when legitimately unavailable'],
    inputMetrics: ['anchor_coverage'],
    outputMetrics: ['anchor_coverage'],
    failClosedRule: 'Missing exact anchor routes to Needs Targeting unless manuscript-wide support is explicitly justified.',
  },
  {
    key: 'criterion',
    label: 'Criterion',
    definition: 'Canonical evaluation criterion that produced or owns the revision opportunity.',
    requiredInputs: ['criterion'],
    requiredOutputs: ['human-readable criterion label'],
    inputMetrics: ['criteria_totals'],
    outputMetrics: ['criteria_totals'],
    failClosedRule: 'Non-canonical or empty criteria must not be invented at render time.',
  },
  {
    key: 'issue',
    label: 'Issue',
    definition: 'Concise author-facing issue statement plus supporting excerpt where available.',
    requiredInputs: ['rationale or issueStatement', 'symptom', 'cause', 'evidence_anchor'],
    requiredOutputs: ['clean issue text without internal artifact leakage'],
    inputMetrics: ['anchor_coverage', 'ledger_backing_coverage'],
    outputMetrics: ['ready_for_revise', 'needs_targeting'],
    failClosedRule: 'Vague advice, missing evidence, or internal leakage kicks the item to Needs Targeting or suppression.',
  },
  {
    key: 'options',
    label: 'Options',
    definition: 'Availability of manuscript-ready A/B/C candidate repair prose.',
    requiredInputs: ['candidate_text_a', 'candidate_text_b', 'candidate_text_c', 'revision_operation'],
    requiredOutputs: ['count of valid A/B/C options or empty marker'],
    inputMetrics: ['candidate_option_coverage'],
    outputMetrics: ['ready_for_revise', 'needs_targeting', 'candidate_option_coverage'],
    failClosedRule: 'Missing or meta-editorial candidate text prevents Ready status and blocks TrustedPath.',
  },
  {
    key: 'status',
    label: 'Status',
    definition: 'Readiness result for the row: Ready for Revise or Needs Targeting.',
    requiredInputs: ['readiness', 'readinessReason', 'validateReviseCardContract result'],
    requiredOutputs: ['Ready or Needs Targeting author-facing state'],
    inputMetrics: ['ready_for_revise', 'needs_targeting'],
    outputMetrics: ['ready_for_revise', 'needs_targeting', 'ready_rate'],
    failClosedRule: 'Any failed Revise card contract requirement must route backward to Needs Targeting, not forward to author-approvable repair.',
  },
] as const;

export const REVISION_DECISION_LEDGER_COLUMNS: readonly RevisionDecisionLedgerColumnDefinition[] = [
  {
    key: 'decision',
    label: 'Decision',
    definition: 'Author action taken for a queue item: accept, reject, defer, customize, or undo.',
    requiredInputs: ['author decision event', 'opportunity_id'],
    requiredOutputs: ['human-readable decision label'],
    inputMetrics: ['author_decision_count'],
    outputMetrics: ['author_decision_count'],
    failClosedRule: 'Do not persist a decision without a ledger-backed opportunity binding.',
  },
  {
    key: 'option',
    label: 'Option',
    definition: 'Selected A/B/C repair option, if the decision used a generated candidate.',
    requiredInputs: ['selected option key', 'candidate text'],
    requiredOutputs: ['A, B, C, or empty marker'],
    inputMetrics: ['candidate_option_coverage'],
    outputMetrics: ['author_decision_count'],
    failClosedRule: 'TrustedPath may only auto-select trusted Option A with valid candidate text.',
  },
  {
    key: 'criterion',
    label: 'Criterion',
    definition: 'Criterion associated with the decided opportunity.',
    requiredInputs: ['criterion from queue opportunity'],
    requiredOutputs: ['criterion label copied from ledger-backed opportunity'],
    inputMetrics: ['criteria_totals'],
    outputMetrics: ['author_decision_count'],
    failClosedRule: 'Do not create a decision row with invented criterion metadata.',
  },
  {
    key: 'opportunity',
    label: 'Opportunity',
    definition: 'Title/issue summary of the opportunity the author acted on.',
    requiredInputs: ['opportunity_id', 'opportunity title or issue statement'],
    requiredOutputs: ['decision ledger item label'],
    inputMetrics: ['ledger_backing_coverage'],
    outputMetrics: ['author_decision_count'],
    failClosedRule: 'Do not create a decision row without an opportunity_id and source excerpt/location binding.',
  },
  {
    key: 'sync',
    label: 'Sync',
    definition: 'Whether the author decision is local-only, pending sync, synced, or failed.',
    requiredInputs: ['local ledger state', 'server persistence result'],
    requiredOutputs: ['sync status label'],
    inputMetrics: ['author_decision_count'],
    outputMetrics: ['synced_decision_count'],
    failClosedRule: 'Sync errors must be visible as sync state and must not alter manuscript application control flow.',
  },
] as const;

export function getReviseQueueLedgerColumnLabel(key: ReviseQueueLedgerColumnKey): string {
  return REVISE_QUEUE_LEDGER_COLUMNS.find((column) => column.key === key)?.label ?? key;
}
