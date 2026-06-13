/**
 * Revise Platform — Executable SIPOC/FIPOC Registry
 *
 * Machine-checkable source of truth for the Revise Workbench, Revise Queue,
 * TrustedPath, and Author Decision Governance processes.
 *
 * Scope:
 *   Revision Opportunity Ledger → Queue Assembly → Queue Admission →
 *   Revise Workbench → Evidence Load → Candidate Generation → Author Decision →
 *   Ledger Sync → Completion → TrustedPath Eligibility → TrustedPath Execution
 *
 * Governance: docs/SIPOC_REVISE_PROCESS.md
 * Authority:  AI_GOVERNANCE.md (binding)
 */

// ─── Authority Source Families ──────────────────────────────────────────────

export type ReviseAuthorityFamily =
  | 'governance'
  | 'canon'
  | 'contract'
  | 'benchmark'
  | 'registry';

export type ReviseAuthoritySource = {
  authorityId: string;
  family: ReviseAuthorityFamily;
  title: string;
  path: string;
  appliesToStageIds: string[];
  appliesToArtifacts: string[];
  executionUse: string;
  notes: string;
};

export const REVISE_AUTHORITY_SOURCE_REGISTRY: readonly ReviseAuthoritySource[] = [
  {
    authorityId: 'AI_GOVERNANCE',
    family: 'governance',
    title: 'AI Governance',
    path: 'AI_GOVERNANCE.md',
    appliesToStageIds: ['RS01_LEDGER_ASSEMBLY', 'RS02_QUEUE_ADMISSION', 'RS03_QUEUE_PRIORITIZATION', 'RS04_WORKBENCH_LOAD', 'RS05_CANDIDATE_GENERATION', 'RS06_AUTHOR_DECISION', 'RS07_LEDGER_SYNC', 'RS08_COMPLETION', 'RS09_CROSSCHECK_VERIFICATION', 'RS10_TRUSTEDPATH'],
    appliesToArtifacts: ['revision_opportunity_ledger_v1', 'revise_queue_v1', 'revision_ledger_decision_v1'],
    executionUse: 'Binding governance for all Revise platform stages. No stage may guess, simulate, or fabricate author decisions or revision state.',
    notes: 'Illegal state transitions must throw and must not write to the database.',
  },
  {
    authorityId: 'REVISE_CARD_CONTRACT',
    family: 'contract',
    title: 'Revise Card Contract',
    path: 'lib/revision/reviseCardContract.ts',
    appliesToStageIds: ['RS02_QUEUE_ADMISSION', 'RS04_WORKBENCH_LOAD'],
    appliesToArtifacts: ['revise_card_v1', 'revise_queue_v1'],
    executionUse: 'Defines RevisionReadiness, RevisionOperation, and RevisionOptionRole. Enforces card contract validation for queue admission.',
    notes: 'RevisionReadiness is exactly: ready_for_revise | needs_targeting.',
  },
  {
    authorityId: 'REVISE_QUEUE_LEDGER_CONTRACT',
    family: 'contract',
    title: 'Revise Queue Ledger Contract',
    path: 'lib/revision/reviseQueueLedgerContract.ts',
    appliesToStageIds: ['RS01_LEDGER_ASSEMBLY', 'RS02_QUEUE_ADMISSION', 'RS03_QUEUE_PRIORITIZATION'],
    appliesToArtifacts: ['revise_queue_v1', 'revision_opportunity_ledger_v1'],
    executionUse: 'Canonical column definitions, ledger limits (short=50, long=100), and metric keys for queue rendering and admission.',
    notes: 'Ledger backing coverage must be 100% — no opportunity may enter the queue without revision_opportunity_ledger_v1 backing.',
  },
  {
    authorityId: 'REVISE_ADMISSION_GATE',
    family: 'contract',
    title: 'Revise Admission Gate',
    path: 'lib/revision/reviseAdmissionGate.ts',
    appliesToStageIds: ['RS02_QUEUE_ADMISSION'],
    appliesToArtifacts: ['revise_card_v1', 'revise_admission_result_v1'],
    executionUse: 'Admission gate for workbench items: validates six-part diagnostic, candidate quality, canon gate, voice gate, and recommendation integrity.',
    notes: 'admission_status is exactly: admission_passed | withheld. Withheld items are not destroyed — they remain in Needs Targeting.',
  },
  {
    authorityId: 'MODE_CONTRACT',
    family: 'contract',
    title: 'Revision Mode Contract',
    path: 'lib/revision/modeContract.ts',
    appliesToStageIds: ['RS01_LEDGER_ASSEMBLY', 'RS02_QUEUE_ADMISSION', 'RS04_WORKBENCH_LOAD', 'RS05_CANDIDATE_GENERATION', 'RS10_TRUSTEDPATH'],
    appliesToArtifacts: ['revision_mode_contract_v1', 'revision_opportunity_ledger_v1'],
    executionUse: 'Binds EvaluationMode (STANDARD | TRANSGRESSIVE | TESTIMONY) and VoicePreservationMode (BALANCED | POLISHED | MAXIMUM) to all Revise pipeline decisions.',
    notes: 'Mode contract is sourced from evaluation_result_v2.confirmed_mode. Never re-inferred in Revise.',
  },
  {
    authorityId: 'TRUSTED_PATH_CONTRACT',
    family: 'contract',
    title: 'TrustedPath Contract',
    path: 'lib/revision/trustedPath.ts',
    appliesToStageIds: ['RS09_CROSSCHECK_VERIFICATION', 'RS10_TRUSTEDPATH'],
    appliesToArtifacts: ['repair_cross_check_v1', 'trustedpath_result_v1'],
    executionUse: 'Only approve verdicts from Perplexity cross-check may be auto-applied. All other verdicts (flag, reject, unavailable, pending) require manual author review.',
    notes: 'TrustedPath is not a shortcut past author judgment — it is auto-acceptance of independently verified repairs only.',
  },
  {
    authorityId: 'REPAIR_CROSSCHECK_CONTRACT',
    family: 'contract',
    title: 'Repair Cross-Check Contract',
    path: 'lib/revision/repairCrossCheck.ts',
    appliesToStageIds: ['RS09_CROSSCHECK_VERIFICATION'],
    appliesToArtifacts: ['repair_cross_check_v1'],
    executionUse: 'CrossCheckVerdict is exactly: approve | flag | reject | unavailable | pending. Cross-check is idempotent, content-hash-keyed, and feature-flagged.',
    notes: 'Cross-check is a sidecar verification only. It does not generate repairs; it independently evaluates Option A only.',
  },
  {
    authorityId: 'SESSION_TRANSITIONS_CONTRACT',
    family: 'contract',
    title: 'Revision Session State Machine',
    path: 'lib/revision/sessionTransitions.ts',
    appliesToStageIds: ['RS04_WORKBENCH_LOAD', 'RS07_LEDGER_SYNC', 'RS08_COMPLETION'],
    appliesToArtifacts: ['revision_session_v1'],
    executionUse: 'RevisionSessionStatus allowed transitions: open→findings_ready→synthesis_started→proposals_ready→applied|failed. Illegal transitions throw; they do not write.',
    notes: 'applied and failed are terminal states. No transition out of either is permitted.',
  },
  {
    authorityId: 'REVISE_SIPOC_CONSTITUTION',
    family: 'governance',
    title: 'Revise Platform SIPOC Constitution',
    path: 'docs/SIPOC_REVISE_PROCESS.md',
    appliesToStageIds: ['RS01_LEDGER_ASSEMBLY', 'RS02_QUEUE_ADMISSION', 'RS03_QUEUE_PRIORITIZATION', 'RS04_WORKBENCH_LOAD', 'RS05_CANDIDATE_GENERATION', 'RS06_AUTHOR_DECISION', 'RS07_LEDGER_SYNC', 'RS08_COMPLETION', 'RS09_CROSSCHECK_VERIFICATION', 'RS10_TRUSTEDPATH'],
    appliesToArtifacts: ['revision_opportunity_ledger_v1', 'revise_queue_v1', 'revision_ledger_decision_v1', 'revision_completion_record_v1', 'trustedpath_result_v1'],
    executionUse: 'Canonical Revise Platform SIPOC defining all 10 stages, artifacts, kicks, and certification status.',
    notes: 'This document is the Revise Platform counterpart to SIPOC_EVALUATION_PROCESS.md.',
  },
];

// ─── Process Registry ────────────────────────────────────────────────────────

export type ReviseActiveState =
  | 'active'
  | 'partial'
  | 'planned_required'
  | 'emerging';

export type ReviseCertificationStatus =
  | 'certified'
  | 'partial'
  | 'emerging'
  | 'missing_critical';

export type ReviseStage = {
  sequence: number;
  phase: string;
  stageId: string;
  processName: string;
  activeState: ReviseActiveState;
  supplier: string;
  inputArtifacts: string[];
  inputRequiredFields: string[];
  inputMetrics: string[];
  codeSurfaces: string[];
  processContract: string;
  outputArtifacts: string[];
  outputRequiredFields: string[];
  outputMetrics: string[];
  forwardKick: string;
  backwardKick: string;
  dirtyDataRules: string[];
  retryBudget: number;
  failureCodes: string[];
  consumers: string[];
  uiExposed: boolean;
  certificationStatus: ReviseCertificationStatus;
  fitGapStatus: 'proven' | 'emerging' | 'gap' | 'critical';
  notes: string;
};

export const REVISE_PROCESS_REGISTRY: readonly ReviseStage[] = [
  {
    sequence: 10,
    phase: 'Ledger Assembly',
    stageId: 'RS01_LEDGER_ASSEMBLY',
    processName: 'Revision Opportunity Ledger Assembly',
    activeState: 'active',
    supplier: 'Phase 5 certified evaluation_result_v2 plus story ledger, WAVE plan, and diagnostic findings',
    inputArtifacts: ['evaluation_result_v2', 'author_exposure_certification_v1', 'accepted_story_ledger_v1', 'wave_revision_plan_v1', 'quality_gate_diagnostics_v1'],
    inputRequiredFields: ['criteria', 'confirmed_mode', 'enrichment', 'overview'],
    inputMetrics: ['evaluation_result_v2 present', 'no blocking audit verdicts', 'criteria count >= 1'],
    codeSurfaces: ['lib/revision/opportunityLedger.ts', 'lib/revision/revisionOpportunityLedgerArtifact.ts', 'lib/revision/normalizeFindings.ts'],
    processContract: 'Build evidence-backed revision opportunities from certified evaluation artifacts without re-running evaluation. Every opportunity must trace to an evaluation finding or story ledger entry.',
    outputArtifacts: ['revision_opportunity_ledger_v1'],
    outputRequiredFields: ['opportunity_id', 'finding_id', 'criterion', 'severity', 'evidence_anchor', 'revision_operation', 'readiness'],
    outputMetrics: ['total_opportunities >= 1', 'no opportunity without evidence_anchor or manuscript_wide_support', 'all criteria traceable'],
    forwardKick: 'RS02_QUEUE_ADMISSION',
    backwardKick: 'S10b_PHASE5_AUTHOR_EXPOSURE_GATE if evaluation_result_v2 absent or uncertified',
    dirtyDataRules: ['missing evidence_anchor without manuscript_wide_support', 'opportunity with no criterion', 'duplicate opportunity_id'],
    retryBudget: 1,
    failureCodes: ['LEDGER_ASSEMBLY_FAILED', 'LEDGER_EVIDENCE_MISSING', 'LEDGER_EMPTY', 'LEDGER_CRITERION_MISSING'],
    consumers: ['RS02_QUEUE_ADMISSION'],
    uiExposed: false,
    certificationStatus: 'partial',
    fitGapStatus: 'gap',
    notes: 'opportunityLedger.ts is active; revisionOpportunityLedgerArtifact.ts writes the artifact. Hard caps: short-form max 50, long-form max 100 opportunities.',
  },
  {
    sequence: 20,
    phase: 'Queue Admission',
    stageId: 'RS02_QUEUE_ADMISSION',
    processName: 'Queue Admission Gate',
    activeState: 'active',
    supplier: 'revision_opportunity_ledger_v1 opportunities',
    inputArtifacts: ['revision_opportunity_ledger_v1', 'revision_mode_contract_v1'],
    inputRequiredFields: ['opportunity_id', 'severity', 'issueStatement', 'symptom', 'cause', 'fixDirection', 'readerEffect', 'evidence_anchor', 'revision_operation'],
    inputMetrics: ['all six diagnostic fields populated', 'revision_operation set', 'readiness classified'],
    codeSurfaces: ['lib/revision/reviseAdmissionGate.ts', 'lib/revision/reviseCardContract.ts', 'lib/revision/candidateQuality.ts', 'lib/revision/canonGate.ts', 'lib/revision/voiceGate.ts'],
    processContract: 'Validate each opportunity against the Revise Card Contract. Items passing all gates become ready_for_revise; items failing any gate become needs_targeting. No item is deleted — withheld items persist for author targeting.',
    outputArtifacts: ['revise_queue_v1', 'revise_admission_result_v1'],
    outputRequiredFields: ['opportunity_id', 'admission_status', 'readiness', 'reasons'],
    outputMetrics: ['ready_for_revise count', 'needs_targeting count', 'ready_rate', 'candidate_option_coverage', 'anchor_coverage'],
    forwardKick: 'RS03_QUEUE_PRIORITIZATION',
    backwardKick: 'RS01_LEDGER_ASSEMBLY if ledger_backing_coverage < 100%',
    dirtyDataRules: ['missing six-part diagnostic', 'candidate_text empty when operation requires one', 'anchor missing without manuscript_wide_support', 'canon gate fail', 'voice gate fail'],
    retryBudget: 0,
    failureCodes: ['ADMISSION_CARD_CONTRACT_FAIL', 'ADMISSION_CANON_GATE_FAIL', 'ADMISSION_VOICE_GATE_FAIL', 'ADMISSION_CANDIDATE_QUALITY_FAIL'],
    consumers: ['RS03_QUEUE_PRIORITIZATION'],
    uiExposed: false,
    certificationStatus: 'partial',
    fitGapStatus: 'emerging',
    notes: 'admission_status is exactly: admission_passed | withheld. Six-part diagnostic is exactly: symptom, cause, fixDirection, readerEffect, evidence_anchor, revision_operation. UI/card aliases: fixStrategy=fixDirection, readerImpact=readerEffect, operationTargeting=revision_operation + location, evidence.quotedExcerpt=evidence_anchor.',
  },
  {
    sequence: 30,
    phase: 'Queue Management',
    stageId: 'RS03_QUEUE_PRIORITIZATION',
    processName: 'Queue Prioritization and Assembly',
    activeState: 'active',
    supplier: 'Admitted revise_queue_v1 items',
    inputArtifacts: ['revise_queue_v1', 'revision_opportunity_ledger_v1'],
    inputRequiredFields: ['opportunity_id', 'severity', 'scope', 'criterion', 'readiness'],
    inputMetrics: ['severity distribution (must/should/could)', 'scope distribution', 'criteria coverage'],
    codeSurfaces: ['lib/revision/workbenchQueue.ts', 'app/revise/page.tsx', 'app/api/revise/reset-queue/route.ts'],
    processContract: 'Sort admitted opportunities by deterministic severity ranking (must → should → could), apply hard cap, and assemble author-facing revise queue. needs_targeting items appear in a separate advisory view.',
    outputArtifacts: ['revise_queue_v1'],
    outputRequiredFields: ['opportunity_id', 'display_index', 'severity', 'scope', 'criterion', 'readiness', 'source'],
    outputMetrics: ['queue_length <= hard_cap', 'must items ranked first', 'no gaps in display_index'],
    forwardKick: 'RS04_WORKBENCH_LOAD',
    backwardKick: 'RS02_QUEUE_ADMISSION if queue empty after hard cap',
    dirtyDataRules: ['queue_length > hard_cap after trim', 'gaps in display_index', 'duplicate opportunity_id in queue'],
    retryBudget: 0,
    failureCodes: ['QUEUE_ASSEMBLY_FAILED', 'QUEUE_OVERCAP', 'QUEUE_EMPTY_AFTER_ADMISSION'],
    consumers: ['RS04_WORKBENCH_LOAD'],
    uiExposed: true,
    certificationStatus: 'emerging',
    fitGapStatus: 'emerging',
    notes: 'WorkbenchSource order: evaluation > deep_revision > baseline_discovery > surface_polish. Reset queue API exists at app/api/revise/reset-queue/route.ts.',
  },
  {
    sequence: 40,
    phase: 'Workbench',
    stageId: 'RS04_WORKBENCH_LOAD',
    processName: 'Workbench Evidence Load',
    activeState: 'active',
    supplier: 'revise_queue_v1 item, revision_package_v1, and warmup corpus',
    inputArtifacts: ['revise_queue_v1', 'revision_opportunity_ledger_v1', 'revision_mode_contract_v1'],
    inputRequiredFields: ['opportunity_id', 'anchor', 'quoteHighlight', 'quoteRest', 'criterion', 'issueStatement', 'diagnostic'],
    inputMetrics: ['anchor text locatable in source manuscript', 'mode contract resolved', 'warmup corpus loaded'],
    codeSurfaces: ['lib/revision/workbenchQueue.ts', 'lib/revision/revisionPackage.ts', 'lib/revision/reviseQueueWarmup.ts', 'lib/revision/baselineManuscriptDiscovery.ts', 'app/revise/page.tsx'],
    processContract: 'Load and hydrate one workbench opportunity: resolve anchor in source manuscript, hydrate diagnostic fields, load A/B/C candidates, resolve mode contract, and surface evidence for author review.',
    outputArtifacts: ['workbench_opportunity_v1'],
    outputRequiredFields: ['id', 'severity', 'scope', 'mode', 'criterion', 'anchor', 'quoteHighlight', 'options', 'diagnostic', 'revisionOperation', 'readiness'],
    outputMetrics: ['anchor resolved in source', 'all six diagnostic fields populated', 'options array has 1–3 valid candidates'],
    forwardKick: 'RS05_CANDIDATE_GENERATION if candidates absent, else RS06_AUTHOR_DECISION',
    backwardKick: 'RS02_QUEUE_ADMISSION if anchor cannot be resolved',
    dirtyDataRules: ['anchor not found in source manuscript', 'diagnostic field empty or placeholder', 'options array empty', 'mode contract missing'],
    retryBudget: 1,
    failureCodes: ['WORKBENCH_ANCHOR_UNRESOLVABLE', 'WORKBENCH_DIAGNOSTIC_INCOMPLETE', 'WORKBENCH_MODE_CONTRACT_MISSING', 'WORKBENCH_HYDRATION_FAILED'],
    consumers: ['RS05_CANDIDATE_GENERATION', 'RS06_AUTHOR_DECISION'],
    uiExposed: true,
    certificationStatus: 'emerging',
    fitGapStatus: 'emerging',
    notes: 'WorkbenchMode is exactly: direct-rewrite | repair-brief. WorkbenchScope: Line | Passage | Scene | Chapter | Structural | Manuscript.',
  },
  {
    sequence: 50,
    phase: 'Workbench',
    stageId: 'RS05_CANDIDATE_GENERATION',
    processName: 'A/B/C Candidate Generation',
    activeState: 'active',
    supplier: 'workbench_opportunity_v1 plus revision warmup corpus and mode contract',
    inputArtifacts: ['workbench_opportunity_v1', 'revision_mode_contract_v1'],
    inputRequiredFields: ['anchor', 'revisionOperation', 'diagnostic', 'mode', 'criterion'],
    inputMetrics: ['mode contract present', 'warmup corpus loaded', 'revision operation set'],
    codeSurfaces: ['app/api/revise/generate-rewrite/route.ts', 'lib/revision/run-revision-pipeline.ts', 'lib/revision/revisionOrchestrator.ts', 'lib/revision/candidateHydration.ts', 'lib/revision/proposalSynthesis.ts', 'lib/revision/proposals.ts', 'lib/revision/runPass4VoiceRewrite.ts'],
    processContract: 'Generate exactly three revision candidates (Option A — Recommended Repair, Option B — Rhythm Variant, Option C — Bolder Rendering Shift) for a ready_for_revise opportunity using Pass 4 voice rewrite. No re-evaluation of criteria.',
    outputArtifacts: ['revision_candidate_set_v1'],
    outputRequiredFields: ['option_key', 'candidate_text', 'mechanism', 'rationale'],
    outputMetrics: ['exactly 3 candidates (A/B/C) unless mode restricts', 'no candidate duplicates original text', 'voice gate passes'],
    forwardKick: 'RS09_CROSSCHECK_VERIFICATION (async, feature-flagged), then RS06_AUTHOR_DECISION',
    backwardKick: 'RS04_WORKBENCH_LOAD if generation fails',
    dirtyDataRules: ['candidate_text = original_text', 'empty candidate_text', 'voice gate violation', 'canon gate violation', 'missing mechanism or rationale'],
    retryBudget: 1,
    failureCodes: ['CANDIDATE_GENERATION_FAILED', 'CANDIDATE_VOICE_GATE_FAIL', 'CANDIDATE_CANON_GATE_FAIL', 'CANDIDATE_EMPTY', 'CANDIDATE_DUPLICATES_ORIGINAL'],
    consumers: ['RS06_AUTHOR_DECISION', 'RS09_CROSSCHECK_VERIFICATION'],
    uiExposed: true,
    certificationStatus: 'partial',
    fitGapStatus: 'emerging',
    notes: 'Pass 4 voice rewrite uses the warmup corpus (benchmark + exemplar files). Option roles: A=recommended_repair, B=rhythm_variant, C=bolder_rendering_shift.',
  },
  {
    sequence: 60,
    phase: 'Author Decision',
    stageId: 'RS06_AUTHOR_DECISION',
    processName: 'Author Decision Capture',
    activeState: 'active',
    supplier: 'Author action on workbench_opportunity_v1 with revision_candidate_set_v1',
    inputArtifacts: ['workbench_opportunity_v1', 'revision_candidate_set_v1'],
    inputRequiredFields: ['opportunity_id', 'decision', 'selected_option or custom_text'],
    inputMetrics: ['author action captured', 'decision is legal value'],
    codeSurfaces: ['app/revise/page.tsx', 'lib/revision/ledger.ts'],
    processContract: 'Capture author decision locally before sync. Decision must be one of the canonical values. Undo is supported for the most recent decision. UI must not fabricate, pre-fill, or simulate author decisions.',
    outputArtifacts: ['author_decision_v1'],
    outputRequiredFields: ['local_id', 'opportunity_id', 'decision', 'selected_option', 'client_created_at'],
    outputMetrics: ['decision is canonical', 'local_id unique', 'undo chain intact if is_undo=true'],
    forwardKick: 'RS07_LEDGER_SYNC',
    backwardKick: 'none (author may re-decide before sync)',
    dirtyDataRules: ['non-canonical decision value', 'missing opportunity_id', 'custom_text empty when decision=custom', 'undo without prior local_id'],
    retryBudget: 0,
    failureCodes: ['DECISION_INVALID_VALUE', 'DECISION_MISSING_OPPORTUNITY', 'DECISION_CUSTOM_EMPTY'],
    consumers: ['RS07_LEDGER_SYNC'],
    uiExposed: true,
    certificationStatus: 'partial',
    fitGapStatus: 'emerging',
    notes: 'RevisionLedgerDecision is exactly: accepted_a | accepted_b | accepted_c | custom | keep_original | reject | deferred. Non-canonical values are CI-failing defects.',
  },
  {
    sequence: 70,
    phase: 'Ledger Sync',
    stageId: 'RS07_LEDGER_SYNC',
    processName: 'Revision Ledger Sync',
    activeState: 'active',
    supplier: 'author_decision_v1 entries from local client state',
    inputArtifacts: ['author_decision_v1'],
    inputRequiredFields: ['local_id', 'opportunity_id', 'opportunity_title', 'decision'],
    inputMetrics: ['all decisions validated before write', 'no duplicate local_id', 'is_undo references valid undone_local_id'],
    codeSurfaces: ['lib/revision/ledger.ts', 'lib/revision/logRevisionEvent.ts', 'lib/revision/persistence/log-governance-event.ts'],
    processContract: 'Persist author decisions to revision_ledger_decisions table. Validation runs before every write. Illegal decision values must throw and must not write. Undo is an append-only log entry, not a mutation.',
    outputArtifacts: ['revision_ledger_decision_v1'],
    outputRequiredFields: ['id', 'local_id', 'opportunity_id', 'decision', 'client_synced_at', 'created_at'],
    outputMetrics: ['synced_decision_count increments by batch size', 'no row with non-canonical decision written', 'governance event logged'],
    forwardKick: 'RS08_COMPLETION when all ready_for_revise items decided',
    backwardKick: 'RS06_AUTHOR_DECISION if sync fails (client retries)',
    dirtyDataRules: ['non-canonical decision written to DB', 'duplicate local_id', 'missing opportunity_id on write', 'undo without undone_local_id'],
    retryBudget: 3,
    failureCodes: ['LEDGER_SYNC_VALIDATION_FAIL', 'LEDGER_SYNC_DB_ERROR', 'LEDGER_SYNC_DUPLICATE_LOCAL_ID'],
    consumers: ['RS08_COMPLETION', 'RS10_TRUSTEDPATH'],
    uiExposed: false,
    certificationStatus: 'partial',
    fitGapStatus: 'gap',
    notes: 'Append-only ledger. Mutations are forbidden. Undo is a new row with is_undo=true. Quality drift metrics tracked via RevisionQualityDriftMetrics.',
  },
  {
    sequence: 80,
    phase: 'Completion',
    stageId: 'RS08_COMPLETION',
    processName: 'Revision Completion Certification',
    activeState: 'active',
    supplier: 'revision_ledger_decision_v1 plus revise_queue_v1 state',
    inputArtifacts: ['revision_ledger_decision_v1', 'revise_queue_v1', 'author_decision_v1'],
    inputRequiredFields: ['all ready_for_revise items have a persisted decision', 'no pending sync entries'],
    inputMetrics: ['author_decision_count >= ready_for_revise count', 'synced_decision_count = author_decision_count', 'no needs_targeting items upgraded without re-admission'],
    codeSurfaces: ['lib/revision/reviseCompletionCertification.ts', 'lib/revision/finalReviewRuntime.ts'],
    processContract: 'Certify revision completion when all ready_for_revise items have persisted author decisions before Final Review apply/export. Persist revision_completion_record_v1 as a canonical evaluation artifact and record the artifact id in Final Review run metadata. Completion does not require all needs_targeting items to be decided.',
    outputArtifacts: ['revision_completion_record_v1'],
    outputRequiredFields: ['manuscript_id', 'evaluation_job_id', 'completion_type', 'decided_count', 'total_ready', 'certified_at'],
    outputMetrics: ['decided_count = total_ready', 'no uncommitted decisions', 'completion_type is canonical'],
    forwardKick: 'RS10_TRUSTEDPATH (if eligible) or end state',
    backwardKick: 'RS07_LEDGER_SYNC if uncommitted decisions remain',
    dirtyDataRules: ['completion certified with pending sync', 'completion_type non-canonical', 'decided_count < total_ready'],
    retryBudget: 0,
    failureCodes: ['COMPLETION_PREMATURE', 'COMPLETION_PENDING_SYNC', 'COMPLETION_CERT_INVALID'],
    consumers: ['RS10_TRUSTEDPATH'],
    uiExposed: true,
    certificationStatus: 'certified',
    fitGapStatus: 'proven',
    notes: 'Runtime RCG07 gate is active before Final Review apply/export. Successful certification persists revision_completion_record_v1 through canonical evaluation_artifacts; blocking failures emit failure_diagnosis_v1 metadata and prevent Final Review completion.',
  },
  {
    sequence: 85,
    phase: 'Cross-Check',
    stageId: 'RS09_CROSSCHECK_VERIFICATION',
    processName: 'Repair Cross-Check Verification',
    activeState: 'active',
    supplier: 'revision_candidate_set_v1 (Option A only)',
    inputArtifacts: ['revision_candidate_set_v1'],
    inputRequiredFields: ['finding_id', 'option_key=A', 'original_text', 'evidence_excerpt', 'diagnosis'],
    inputMetrics: ['REVISION_REPAIR_CROSSCHECK_ENABLED feature flag true', 'content hashes available for deduplication'],
    codeSurfaces: ['lib/revision/repairCrossCheck.ts', 'lib/revision/trustedPath.ts'],
    processContract: 'Independently verify Option A repair using Perplexity sonar-reasoning-pro. Idempotent and content-hash-keyed. Does not generate repairs. Only approve verdicts propagate to TrustedPath.',
    outputArtifacts: ['repair_cross_check_v1'],
    outputRequiredFields: ['verdict', 'rationale', 'concerns', 'confidence', 'promptVersion', 'model'],
    outputMetrics: ['verdict is one of: approve | flag | reject | unavailable | pending', 'content hash matches input', 'idempotent on re-run'],
    forwardKick: 'RS10_TRUSTEDPATH if verdict=approve',
    backwardKick: 'RS06_AUTHOR_DECISION (flag/reject remain in manual review)',
    dirtyDataRules: ['non-canonical verdict value', 'cross-check modifies repair text (forbidden)', 'content hash mismatch on cache hit'],
    retryBudget: 2,
    failureCodes: ['CROSSCHECK_TIMEOUT', 'CROSSCHECK_INVALID_VERDICT', 'CROSSCHECK_HASH_MISMATCH', 'CROSSCHECK_UNAVAILABLE'],
    consumers: ['RS10_TRUSTEDPATH'],
    uiExposed: false,
    certificationStatus: 'partial',
    fitGapStatus: 'emerging',
    notes: 'Feature-flagged via REVISION_REPAIR_CROSSCHECK_ENABLED. Runs async and does not block workbench display. Perplexity model: sonar-reasoning-pro, prompt version: repair-cross-check-v1.',
  },
  {
    sequence: 90,
    phase: 'TrustedPath',
    stageId: 'RS10_TRUSTEDPATH',
    processName: 'TrustedPath Auto-Apply',
    activeState: 'active',
    supplier: 'repair_cross_check_v1 with verdict=approve',
    inputArtifacts: ['repair_cross_check_v1', 'revision_opportunity_ledger_v1', 'revision_mode_contract_v1'],
    inputRequiredFields: ['finding_id', 'verdict=approve', 'option_key', 'evaluation_job_id', 'manuscript_id'],
    inputMetrics: ['isTrustedPathEligible passes', 'no prior ledger decision for finding_id', 'user authenticated'],
    codeSurfaces: ['lib/revision/trustedPath.ts', 'lib/revision/repairCrossCheck.ts', 'lib/revision/ledger.ts', 'app/api/revise/trusted-path/route.ts'],
    processContract: 'Auto-accept all cross-check-approved Option A repairs into revision_ledger_decisions. Skip findings already decided, flagged, rejected, unavailable, or pending. Original manuscript is never mutated — ledger entries only.',
    outputArtifacts: ['trustedpath_result_v1', 'revision_ledger_decision_v1'],
    outputRequiredFields: ['ok', 'appliedCount', 'skippedCount', 'alreadyDecidedCount', 'appliedFindingIds', 'skippedReasons'],
    outputMetrics: ['appliedCount + skippedCount + alreadyDecidedCount = total eligible', 'no mutation to source manuscript', 'all applied decisions = accepted_a'],
    forwardKick: 'RS08_COMPLETION',
    backwardKick: 'RS06_AUTHOR_DECISION for skipped items',
    dirtyDataRules: ['applying non-approve verdict', 'mutating source manuscript text', 'applying to already-decided finding', 'unauthenticated call'],
    retryBudget: 1,
    failureCodes: ['TRUSTEDPATH_UNAUTHENTICATED', 'TRUSTEDPATH_INELIGIBLE_VERDICT', 'TRUSTEDPATH_ALREADY_DECIDED', 'TRUSTEDPATH_LEDGER_WRITE_FAIL'],
    consumers: ['RS08_COMPLETION'],
    uiExposed: true,
    certificationStatus: 'partial',
    fitGapStatus: 'emerging',
    notes: 'TrustedPath auto-apply uses source="trustedpath-auto-apply" on every ledger entry. Feature designed for time-pressed authors with large queues of verified repairs.',
  },
];

// ─── Artifact Registry ───────────────────────────────────────────────────────

export type ReviseArtifact = {
  artifact: string;
  producerStageId: string;
  consumerStageIds: string[];
  requiredFields: string[];
  completenessMetric: string;
  accuracyMetric: string;
  dirtyDataRule: string;
  regenerationOwnerStageId: string;
  requiredForAuthorExposure: boolean;
  fitGapStatus: 'proven' | 'emerging' | 'gap' | 'critical';
};

export const REVISE_ARTIFACT_REGISTRY: readonly ReviseArtifact[] = [
  {
    artifact: 'revision_opportunity_ledger_v1',
    producerStageId: 'RS01_LEDGER_ASSEMBLY',
    consumerStageIds: ['RS02_QUEUE_ADMISSION', 'RS03_QUEUE_PRIORITIZATION', 'RS04_WORKBENCH_LOAD', 'RS10_TRUSTEDPATH'],
    requiredFields: ['opportunity_id', 'finding_id', 'criterion', 'severity', 'evidence_anchor', 'revision_operation', 'readiness'],
    completenessMetric: 'all criteria with actionable findings represented, evidence_anchor or manuscript_wide_support on every entry',
    accuracyMetric: 'all opportunity_ids unique, all criteria trace to evaluation_result_v2 criteria keys',
    dirtyDataRule: 'missing finding_id or empty evidence_anchor without manuscript_wide_support rejects ledger assembly',
    regenerationOwnerStageId: 'RS01_LEDGER_ASSEMBLY',
    requiredForAuthorExposure: true,
    fitGapStatus: 'emerging',
  },
  {
    artifact: 'revise_queue_v1',
    producerStageId: 'RS03_QUEUE_PRIORITIZATION',
    consumerStageIds: ['RS04_WORKBENCH_LOAD', 'RS07_LEDGER_SYNC', 'RS08_COMPLETION'],
    requiredFields: ['opportunity_id', 'display_index', 'severity', 'scope', 'criterion', 'readiness', 'source'],
    completenessMetric: 'queue_length <= hard_cap, display_index sequential with no gaps, all items have readiness classification',
    accuracyMetric: 'severity ranking: must first, should second, could last; source order: evaluation > deep_revision > baseline_discovery > surface_polish',
    dirtyDataRule: 'duplicate opportunity_id or gap in display_index fails queue assembly',
    regenerationOwnerStageId: 'RS03_QUEUE_PRIORITIZATION',
    requiredForAuthorExposure: true,
    fitGapStatus: 'emerging',
  },
  {
    artifact: 'revise_admission_result_v1',
    producerStageId: 'RS02_QUEUE_ADMISSION',
    consumerStageIds: ['RS03_QUEUE_PRIORITIZATION'],
    requiredFields: ['opportunity_id', 'admission_status', 'reasons', 'passedCandidateCount'],
    completenessMetric: 'every opportunity in ledger has an admission result',
    accuracyMetric: 'admission_status is exactly: admission_passed | withheld',
    dirtyDataRule: 'non-canonical admission_status is a CI-failing defect',
    regenerationOwnerStageId: 'RS02_QUEUE_ADMISSION',
    requiredForAuthorExposure: false,
    fitGapStatus: 'emerging',
  },
  {
    artifact: 'revise_card_v1',
    producerStageId: 'RS02_QUEUE_ADMISSION',
    consumerStageIds: ['RS04_WORKBENCH_LOAD'],
    requiredFields: ['opportunity_id', 'readiness', 'revisionOperation', 'candidateTexts', 'sourceText', 'sourceLocationLabel', 'issueStatement', 'symptom', 'cause', 'fixDirection', 'readerEffect', 'diagnostic.fixStrategy', 'diagnostic.readerImpact', 'diagnostic.evidence.quotedExcerpt', 'diagnostic.operationTargeting'],
    completenessMetric: 'six-part diagnostic fully populated for admission_passed items',
    accuracyMetric: 'readiness is exactly: ready_for_revise | needs_targeting',
    dirtyDataRule: 'any empty or placeholder diagnostic field fails card contract',
    regenerationOwnerStageId: 'RS02_QUEUE_ADMISSION',
    requiredForAuthorExposure: true,
    fitGapStatus: 'emerging',
  },
  {
    artifact: 'revision_mode_contract_v1',
    producerStageId: 'RS01_LEDGER_ASSEMBLY',
    consumerStageIds: ['RS02_QUEUE_ADMISSION', 'RS04_WORKBENCH_LOAD', 'RS05_CANDIDATE_GENERATION', 'RS10_TRUSTEDPATH'],
    requiredFields: ['evaluation_mode', 'voice_preservation', 'source', 'policy_family'],
    completenessMetric: 'mode contract derived from evaluation_result_v2.confirmed_mode before any Revise stage runs',
    accuracyMetric: 'evaluation_mode is exactly: STANDARD | TRANSGRESSIVE | TESTIMONY; voice_preservation is exactly: BALANCED | POLISHED | MAXIMUM',
    dirtyDataRule: 'non-canonical mode value or missing source causes mode contract failure',
    regenerationOwnerStageId: 'RS01_LEDGER_ASSEMBLY',
    requiredForAuthorExposure: true,
    fitGapStatus: 'emerging',
  },
  {
    artifact: 'workbench_opportunity_v1',
    producerStageId: 'RS04_WORKBENCH_LOAD',
    consumerStageIds: ['RS05_CANDIDATE_GENERATION', 'RS06_AUTHOR_DECISION'],
    requiredFields: ['id', 'severity', 'scope', 'mode', 'criterion', 'anchor', 'quoteHighlight', 'quoteRest', 'diagnostic', 'revisionOperation', 'readiness', 'options'],
    completenessMetric: 'anchor resolved in source manuscript, all six diagnostic fields non-empty',
    accuracyMetric: 'WorkbenchMode is exactly: direct-rewrite | repair-brief; WorkbenchScope is exactly: Line | Passage | Scene | Chapter | Structural | Manuscript',
    dirtyDataRule: 'anchor not found in source manuscript fails workbench load; diagnostic field empty or placeholder fails card contract',
    regenerationOwnerStageId: 'RS04_WORKBENCH_LOAD',
    requiredForAuthorExposure: true,
    fitGapStatus: 'emerging',
  },
  {
    artifact: 'revision_candidate_set_v1',
    producerStageId: 'RS05_CANDIDATE_GENERATION',
    consumerStageIds: ['RS06_AUTHOR_DECISION', 'RS09_CROSSCHECK_VERIFICATION'],
    requiredFields: ['option_key', 'candidate_text', 'mechanism', 'rationale'],
    completenessMetric: 'three candidates (A/B/C) present for ready_for_revise items unless mode restricts',
    accuracyMetric: 'no candidate_text equals original_text; option roles: A=recommended_repair, B=rhythm_variant, C=bolder_rendering_shift',
    dirtyDataRule: 'empty candidate_text or candidate that duplicates original text fails voice gate',
    regenerationOwnerStageId: 'RS05_CANDIDATE_GENERATION',
    requiredForAuthorExposure: true,
    fitGapStatus: 'emerging',
  },
  {
    artifact: 'author_decision_v1',
    producerStageId: 'RS06_AUTHOR_DECISION',
    consumerStageIds: ['RS07_LEDGER_SYNC'],
    requiredFields: ['local_id', 'opportunity_id', 'opportunity_title', 'decision', 'client_created_at'],
    completenessMetric: 'one decision per opportunity_id (last write wins per local session); undo chain intact',
    accuracyMetric: 'decision is exactly: accepted_a | accepted_b | accepted_c | custom | keep_original | reject | deferred',
    dirtyDataRule: 'non-canonical decision value is a CI-failing defect and must not be written to the database',
    regenerationOwnerStageId: 'RS06_AUTHOR_DECISION',
    requiredForAuthorExposure: false,
    fitGapStatus: 'emerging',
  },
  {
    artifact: 'revision_ledger_decision_v1',
    producerStageId: 'RS07_LEDGER_SYNC',
    consumerStageIds: ['RS08_COMPLETION', 'RS10_TRUSTEDPATH'],
    requiredFields: ['id', 'local_id', 'opportunity_id', 'opportunity_title', 'decision', 'client_synced_at', 'created_at'],
    completenessMetric: 'synced_decision_count = author_decision_count; append-only; no mutations',
    accuracyMetric: 'all decision values canonical; is_undo rows reference valid undone_local_id',
    dirtyDataRule: 'non-canonical decision value written to DB is a governance violation; duplicate local_id fails sync',
    regenerationOwnerStageId: 'RS07_LEDGER_SYNC',
    requiredForAuthorExposure: false,
    fitGapStatus: 'proven',
  },
  {
    artifact: 'revision_session_v1',
    producerStageId: 'RS04_WORKBENCH_LOAD',
    consumerStageIds: ['RS07_LEDGER_SYNC', 'RS08_COMPLETION'],
    requiredFields: ['id', 'evaluation_run_id', 'source_version_id', 'status', 'findings_count', 'actionable_findings_count', 'created_at'],
    completenessMetric: 'revision session has canonical status and source/evaluation linkage before proposals or decisions are persisted',
    accuracyMetric: 'status is exactly: open | findings_ready | synthesis_started | proposals_ready | applied | failed; allowed transitions enforced by sessionTransitions.ts',
    dirtyDataRule: 'illegal status transition must throw and must not write to the database',
    regenerationOwnerStageId: 'RS04_WORKBENCH_LOAD',
    requiredForAuthorExposure: false,
    fitGapStatus: 'emerging',
  },
  {
    artifact: 'repair_cross_check_v1',
    producerStageId: 'RS09_CROSSCHECK_VERIFICATION',
    consumerStageIds: ['RS10_TRUSTEDPATH'],
    requiredFields: ['verdict', 'rationale', 'concerns', 'confidence', 'promptVersion', 'model'],
    completenessMetric: 'verdict present for every Option A candidate when feature flag enabled; idempotent on re-run',
    accuracyMetric: 'verdict is exactly: approve | flag | reject | unavailable | pending',
    dirtyDataRule: 'non-canonical verdict value is a CI-failing defect; cross-check must not modify repair text',
    regenerationOwnerStageId: 'RS09_CROSSCHECK_VERIFICATION',
    requiredForAuthorExposure: false,
    fitGapStatus: 'emerging',
  },
  {
    artifact: 'revision_completion_record_v1',
    producerStageId: 'RS08_COMPLETION',
    consumerStageIds: ['RS10_TRUSTEDPATH'],
    requiredFields: ['manuscript_id', 'evaluation_job_id', 'completion_type', 'decided_count', 'total_ready', 'certified_at'],
    completenessMetric: 'decided_count = total_ready; no uncommitted decisions at certification time',
    accuracyMetric: 'completion_type is exactly: full | partial | needs_targeting_deferred',
    dirtyDataRule: 'completion certified with pending sync or decided_count < total_ready fails completion gate',
    regenerationOwnerStageId: 'RS08_COMPLETION',
    requiredForAuthorExposure: true,
    fitGapStatus: 'proven',
  },
  {
    artifact: 'trustedpath_result_v1',
    producerStageId: 'RS10_TRUSTEDPATH',
    consumerStageIds: ['RS08_COMPLETION'],
    requiredFields: ['ok', 'appliedCount', 'skippedCount', 'alreadyDecidedCount', 'appliedFindingIds', 'skippedReasons'],
    completenessMetric: 'appliedCount + skippedCount + alreadyDecidedCount = total eligible findings',
    accuracyMetric: 'all appliedFindingIds have verdict=approve in repair_cross_check_v1; no source manuscript mutation',
    dirtyDataRule: 'applying to non-approve verdict or already-decided finding is a TrustedPath contract violation',
    regenerationOwnerStageId: 'RS10_TRUSTEDPATH',
    requiredForAuthorExposure: false,
    fitGapStatus: 'emerging',
  },
];

// ─── Field Registry ──────────────────────────────────────────────────────────

export type ReviseField = {
  field: string;
  canonicalType: string;
  ownerArtifact: string;
  allowedValues?: string;
  validationRule: string;
  fitGapStatus: 'proven' | 'emerging' | 'gap' | 'critical';
};

export const REVISE_FIELD_REGISTRY: readonly ReviseField[] = [
  { field: 'admission_status', canonicalType: 'enum', ownerArtifact: 'revise_admission_result_v1', allowedValues: 'admission_passed | withheld', validationRule: 'Exactly these two values. Non-canonical values are CI-failing defects.', fitGapStatus: 'emerging' },
  { field: 'readiness', canonicalType: 'enum', ownerArtifact: 'revise_card_v1', allowedValues: 'ready_for_revise | needs_targeting', validationRule: 'Exactly these two values. Derived from card contract validation.', fitGapStatus: 'emerging' },
  { field: 'decision', canonicalType: 'enum', ownerArtifact: 'author_decision_v1', allowedValues: 'accepted_a | accepted_b | accepted_c | custom | keep_original | reject | deferred', validationRule: 'Exactly these seven values. Non-canonical values must not be written to the database.', fitGapStatus: 'emerging' },
  { field: 'severity', canonicalType: 'enum', ownerArtifact: 'revise_queue_v1', allowedValues: 'must | should | could', validationRule: 'Mapped from ProposalSeverity (high=must, medium=should, low=could) in queue assembly.', fitGapStatus: 'emerging' },
  { field: 'scope', canonicalType: 'enum', ownerArtifact: 'workbench_opportunity_v1', allowedValues: 'Line | Passage | Scene | Chapter | Structural | Manuscript', validationRule: 'WorkbenchScope enum. Exact casing required.', fitGapStatus: 'emerging' },
  { field: 'mode', canonicalType: 'enum', ownerArtifact: 'workbench_opportunity_v1', allowedValues: 'direct-rewrite | repair-brief', validationRule: 'WorkbenchMode enum. Exact values required.', fitGapStatus: 'emerging' },
  { field: 'revision_operation', canonicalType: 'enum', ownerArtifact: 'revision_opportunity_ledger_v1', allowedValues: 'replace_selected_passage | insert_before_selected_passage | insert_after_selected_passage | rewrite_full_paragraph | rewrite_multi_paragraph_span | compress_selected_passage | delete_selected_passage | split_paragraph | merge_paragraphs | reorder_within_section | needs_targeting', validationRule: 'REVISION_OPERATIONS const array. needs_targeting is a valid operation value indicating the item requires targeting before workbench.', fitGapStatus: 'emerging' },
  { field: 'option_key', canonicalType: 'enum', ownerArtifact: 'revision_candidate_set_v1', allowedValues: 'A | B | C', validationRule: 'Exactly A, B, or C. Option roles: A=recommended_repair, B=rhythm_variant, C=bolder_rendering_shift.', fitGapStatus: 'emerging' },
  { field: 'verdict', canonicalType: 'enum', ownerArtifact: 'repair_cross_check_v1', allowedValues: 'approve | flag | reject | unavailable | pending', validationRule: 'CrossCheckVerdict enum. Only approve propagates to TrustedPath.', fitGapStatus: 'emerging' },
  { field: 'completion_type', canonicalType: 'enum', ownerArtifact: 'revision_completion_record_v1', allowedValues: 'full | partial | needs_targeting_deferred', validationRule: 'Runtime-certified field. full = all ready items decided with no unresolved non-ready cards. partial = one or more ready items were explicitly deferred. needs_targeting_deferred = all ready items decided while needs_targeting/withheld items remain outside completion blocking.', fitGapStatus: 'proven' },
  { field: 'evaluation_mode', canonicalType: 'enum', ownerArtifact: 'revision_mode_contract_v1', allowedValues: 'STANDARD | TRANSGRESSIVE | TESTIMONY', validationRule: 'EvaluationMode enum, normalized from evaluation_result_v2.confirmed_mode. Never re-inferred in Revise.', fitGapStatus: 'emerging' },
  { field: 'voice_preservation', canonicalType: 'enum', ownerArtifact: 'revision_mode_contract_v1', allowedValues: 'BALANCED | POLISHED | MAXIMUM', validationRule: 'VoicePreservationMode enum. MAXIMUM activates strictest voice gate in candidate generation.', fitGapStatus: 'emerging' },
  { field: 'source', canonicalType: 'enum', ownerArtifact: 'revise_queue_v1', allowedValues: 'evaluation | deep_revision | baseline_discovery | surface_polish', validationRule: 'WorkbenchSource enum. Priority order: evaluation first, surface_polish last.', fitGapStatus: 'emerging' },
  { field: 'revision_session_status', canonicalType: 'enum', ownerArtifact: 'revision_session_v1', allowedValues: 'open | findings_ready | synthesis_started | proposals_ready | applied | failed', validationRule: 'RevisionSessionStatus. Allowed transitions: open→findings_ready→synthesis_started→proposals_ready→applied|failed. applied and failed are terminal. Illegal transitions throw.', fitGapStatus: 'emerging' },
  { field: 'local_id', canonicalType: 'string', ownerArtifact: 'author_decision_v1', validationRule: 'Client-generated unique identifier for each decision event. Must be globally unique within the session. Undo references undone_local_id.', fitGapStatus: 'emerging' },
  { field: 'evidence_anchor', canonicalType: 'string', ownerArtifact: 'revision_opportunity_ledger_v1', validationRule: 'Exact text excerpt from source manuscript that anchors the finding. Required unless manuscript_wide_support=true.', fitGapStatus: 'emerging' },
  { field: 'is_undo', canonicalType: 'boolean', ownerArtifact: 'revision_ledger_decision_v1', validationRule: 'Append-only undo log entry. True rows must reference a valid undone_local_id. Mutations to existing rows are forbidden.', fitGapStatus: 'gap' },
  { field: 'ledger_backing_coverage', canonicalType: 'metric', ownerArtifact: 'revise_queue_v1', validationRule: 'Share of queue items sourced from revision_opportunity_ledger_v1. Must be 100% — no queue item without ledger backing.', fitGapStatus: 'emerging' },
];

// ─── Kick Matrix ─────────────────────────────────────────────────────────────

export type ReviseKick = {
  kickCode: string;
  triggeringStageId: string;
  targetStageId: string;
  triggerCondition: string;
  resolution: string;
  blocksAuthorExposure: boolean;
  severity: 'blocking' | 'advisory' | 'warning';
};

export const REVISE_KICK_MATRIX: readonly ReviseKick[] = [
  {
    kickCode: 'LEDGER_EVIDENCE_MISSING',
    triggeringStageId: 'RS01_LEDGER_ASSEMBLY',
    targetStageId: 'S10b_PHASE5_AUTHOR_EXPOSURE_GATE',
    triggerCondition: 'evaluation_result_v2 absent or not certified by Phase 5',
    resolution: 'Re-certify evaluation artifact via Phase 5 gate before ledger assembly',
    blocksAuthorExposure: true,
    severity: 'blocking',
  },
  {
    kickCode: 'ADMISSION_CARD_CONTRACT_FAIL',
    triggeringStageId: 'RS02_QUEUE_ADMISSION',
    targetStageId: 'RS01_LEDGER_ASSEMBLY',
    triggerCondition: 'ledger_backing_coverage < 100% or opportunity fails six-part diagnostic',
    resolution: 'Opportunity moves to needs_targeting; ledger re-assembly required only if backing is absent',
    blocksAuthorExposure: false,
    severity: 'advisory',
  },
  {
    kickCode: 'ADMISSION_CANON_GATE_FAIL',
    triggeringStageId: 'RS02_QUEUE_ADMISSION',
    targetStageId: 'RS02_QUEUE_ADMISSION',
    triggerCondition: 'candidate_text violates canon gate (banned entity, voice violation)',
    resolution: 'Opportunity withheld; flagged for author targeting',
    blocksAuthorExposure: false,
    severity: 'advisory',
  },
  {
    kickCode: 'WORKBENCH_ANCHOR_UNRESOLVABLE',
    triggeringStageId: 'RS04_WORKBENCH_LOAD',
    targetStageId: 'RS02_QUEUE_ADMISSION',
    triggerCondition: 'anchor text not found in source manuscript version',
    resolution: 'Opportunity kicked back to needs_targeting; author must retarget before retrying',
    blocksAuthorExposure: false,
    severity: 'advisory',
  },
  {
    kickCode: 'CANDIDATE_VOICE_GATE_FAIL',
    triggeringStageId: 'RS05_CANDIDATE_GENERATION',
    targetStageId: 'RS04_WORKBENCH_LOAD',
    triggerCondition: 'generated candidate violates voice preservation contract for current mode',
    resolution: 'Regenerate candidates; if persistent, escalate mode contract review',
    blocksAuthorExposure: false,
    severity: 'warning',
  },
  {
    kickCode: 'CANDIDATE_CANON_GATE_FAIL',
    triggeringStageId: 'RS05_CANDIDATE_GENERATION',
    targetStageId: 'RS04_WORKBENCH_LOAD',
    triggerCondition: 'generated candidate introduces banned entity or non-canonical name',
    resolution: 'Regenerate candidates without the offending entity',
    blocksAuthorExposure: false,
    severity: 'warning',
  },
  {
    kickCode: 'LEDGER_SYNC_VALIDATION_FAIL',
    triggeringStageId: 'RS07_LEDGER_SYNC',
    targetStageId: 'RS06_AUTHOR_DECISION',
    triggerCondition: 'non-canonical decision value or missing required field on sync write',
    resolution: 'Throw — do not write. Client must re-capture decision with canonical value.',
    blocksAuthorExposure: true,
    severity: 'blocking',
  },
  {
    kickCode: 'DECISION_INVALID_VALUE',
    triggeringStageId: 'RS06_AUTHOR_DECISION',
    targetStageId: 'RS06_AUTHOR_DECISION',
    triggerCondition: 'decision value not in canonical set',
    resolution: 'UI must enforce enum dropdown; non-canonical values are CI-failing defects',
    blocksAuthorExposure: true,
    severity: 'blocking',
  },
  {
    kickCode: 'COMPLETION_PREMATURE',
    triggeringStageId: 'RS08_COMPLETION',
    targetStageId: 'RS07_LEDGER_SYNC',
    triggerCondition: 'completion attempted with uncommitted decisions or decided_count < total_ready',
    resolution: 'Sync all pending decisions before certifying completion',
    blocksAuthorExposure: true,
    severity: 'blocking',
  },
  {
    kickCode: 'TRUSTEDPATH_INELIGIBLE_VERDICT',
    triggeringStageId: 'RS10_TRUSTEDPATH',
    targetStageId: 'RS06_AUTHOR_DECISION',
    triggerCondition: 'TrustedPath called for finding with verdict != approve',
    resolution: 'Route to manual author review; do not auto-apply',
    blocksAuthorExposure: false,
    severity: 'advisory',
  },
  {
    kickCode: 'CROSSCHECK_INVALID_VERDICT',
    triggeringStageId: 'RS09_CROSSCHECK_VERIFICATION',
    targetStageId: 'RS06_AUTHOR_DECISION',
    triggerCondition: 'non-canonical verdict returned from cross-check service',
    resolution: 'Default to unavailable; route to manual review. Log defect.',
    blocksAuthorExposure: false,
    severity: 'warning',
  },
];

// ─── Renderer / Consumer Matrix ─────────────────────────────────────────────

export type ReviseRendererConsumer = {
  surface: string;
  stageId: string;
  codeSurface: string;
  canonicalInput: string;
  forbiddenInputs: string[];
  mayFormatOnly: boolean;
  mayMutateState: boolean;
  requiredCertificationGate: string;
  parityRequiredFields: string[];
  currentFitGapStatus: 'proven' | 'emerging' | 'gap' | 'critical';
  remediationPr: string;
};

export const REVISE_RENDERER_CONSUMPTION_MATRIX: readonly ReviseRendererConsumer[] = [
  {
    surface: 'Revise Queue',
    stageId: 'RS03_QUEUE_PRIORITIZATION',
    codeSurface: 'app/revise/page.tsx',
    canonicalInput: 'revise_queue_v1',
    forbiddenInputs: ['direct evaluation_result_v2 re-diagnosis', 'unbacked local-only queue item', 'fabricated readiness state'],
    mayFormatOnly: true,
    mayMutateState: false,
    requiredCertificationGate: 'RCG02_QUEUE_ADMISSION_CERTIFICATION',
    parityRequiredFields: ['opportunity_id', 'display_index', 'severity', 'scope', 'criterion', 'readiness', 'source'],
    currentFitGapStatus: 'emerging',
    remediationPr: 'future: durable queue lifecycle persistence and queue parity audit',
  },
  {
    surface: 'Revise Workbench Evidence View',
    stageId: 'RS04_WORKBENCH_LOAD',
    codeSurface: 'app/revise/page.tsx; lib/revision/workbenchQueue.ts',
    canonicalInput: 'workbench_opportunity_v1',
    forbiddenInputs: ['unresolved anchor display', 'placeholder diagnostic fields', 'candidate text without source evidence'],
    mayFormatOnly: true,
    mayMutateState: false,
    requiredCertificationGate: 'RCG03_WORKBENCH_EVIDENCE_CERTIFICATION',
    parityRequiredFields: ['id', 'anchor', 'quoteHighlight', 'quoteRest', 'diagnostic', 'revisionOperation', 'readiness'],
    currentFitGapStatus: 'emerging',
    remediationPr: 'future: formal workbench evidence certification artifact',
  },
  {
    surface: 'A/B/C Candidate Generator',
    stageId: 'RS05_CANDIDATE_GENERATION',
    codeSurface: 'app/api/revise/generate-rewrite/route.ts; lib/revision/runPass4VoiceRewrite.ts',
    canonicalInput: 'workbench_opportunity_v1 + revision_mode_contract_v1',
    forbiddenInputs: ['candidate not tied to opportunity_id', 'candidate generated without mode contract', 'candidate duplicating original text'],
    mayFormatOnly: false,
    mayMutateState: false,
    requiredCertificationGate: 'RCG04_CANDIDATE_SET_CERTIFICATION',
    parityRequiredFields: ['option_key', 'candidate_text', 'mechanism', 'rationale'],
    currentFitGapStatus: 'emerging',
    remediationPr: 'future: persisted candidate certification record',
  },
  {
    surface: 'Author Decision Controls',
    stageId: 'RS06_AUTHOR_DECISION',
    codeSurface: 'app/revise/page.tsx',
    canonicalInput: 'revision_candidate_set_v1',
    forbiddenInputs: ['non-canonical decision', 'preselected decision', 'simulated author action'],
    mayFormatOnly: false,
    mayMutateState: true,
    requiredCertificationGate: 'RCG05_AUTHOR_DECISION_CERTIFICATION',
    parityRequiredFields: ['local_id', 'opportunity_id', 'decision', 'selected_option', 'client_created_at'],
    currentFitGapStatus: 'emerging',
    remediationPr: 'future: UI-level author decision enum certification',
  },
  {
    surface: 'Revision Ledger Sync API',
    stageId: 'RS07_LEDGER_SYNC',
    codeSurface: 'lib/revision/ledger.ts',
    canonicalInput: 'author_decision_v1',
    forbiddenInputs: ['mutation of existing decision row', 'non-canonical decision write', 'undo without undone_local_id'],
    mayFormatOnly: false,
    mayMutateState: true,
    requiredCertificationGate: 'RCG06_LEDGER_SYNC_CERTIFICATION',
    parityRequiredFields: ['id', 'local_id', 'opportunity_id', 'decision', 'client_synced_at'],
    currentFitGapStatus: 'gap',
    remediationPr: 'future: formal append-only ledger sync certification artifact',
  },
  {
    surface: 'TrustedPath API',
    stageId: 'RS10_TRUSTEDPATH',
    codeSurface: 'app/api/revise/trusted-path/route.ts; lib/revision/trustedPath.ts',
    canonicalInput: 'repair_cross_check_v1 verdict=approve',
    forbiddenInputs: ['flag verdict', 'reject verdict', 'unavailable verdict', 'pending verdict', 'already-decided finding'],
    mayFormatOnly: false,
    mayMutateState: true,
    requiredCertificationGate: 'RCG08_TRUSTEDPATH_CERTIFICATION',
    parityRequiredFields: ['ok', 'appliedCount', 'skippedCount', 'alreadyDecidedCount', 'appliedFindingIds', 'skippedReasons'],
    currentFitGapStatus: 'emerging',
    remediationPr: 'future: TrustedPath eligibility certification artifact',
  },
];

// ─── Certification Gate Registry ────────────────────────────────────────────

export type ReviseCertificationGate = {
  gateId: string;
  stageId: string;
  gateName: string;
  requiredInputArtifacts: string[];
  requiredChecks: string[];
  outputArtifact: string;
  blockingFailureCodes: string[];
  certificationStatus: ReviseCertificationStatus;
  fitGapStatus: 'proven' | 'emerging' | 'gap' | 'critical';
  notes: string;
};

export const REVISE_CERTIFICATION_GATE_REGISTRY: readonly ReviseCertificationGate[] = [
  {
    gateId: 'RCG01_LEDGER_CERTIFICATION',
    stageId: 'RS01_LEDGER_ASSEMBLY',
    gateName: 'Revision Opportunity Ledger Certification',
    requiredInputArtifacts: ['evaluation_result_v2', 'author_exposure_certification_v1'],
    requiredChecks: ['evaluation certified by Phase 5', 'every opportunity has evidence anchor or manuscript-wide support', 'opportunity_id unique'],
    outputArtifact: 'revision_opportunity_ledger_v1',
    blockingFailureCodes: ['LEDGER_EVIDENCE_MISSING', 'LEDGER_EMPTY'],
    certificationStatus: 'partial',
    fitGapStatus: 'gap',
    notes: 'Ledger artifact exists; formal certification record is not yet emitted.',
  },
  {
    gateId: 'RCG02_QUEUE_ADMISSION_CERTIFICATION',
    stageId: 'RS02_QUEUE_ADMISSION',
    gateName: 'Queue Admission Certification',
    requiredInputArtifacts: ['revision_opportunity_ledger_v1', 'revision_mode_contract_v1'],
    requiredChecks: ['Revise Card Contract passes or item becomes needs_targeting', 'admission_status canonical', 'readiness canonical'],
    outputArtifact: 'revise_admission_result_v1',
    blockingFailureCodes: ['ADMISSION_CARD_CONTRACT_FAIL', 'ADMISSION_CANON_GATE_FAIL', 'ADMISSION_VOICE_GATE_FAIL'],
    certificationStatus: 'partial',
    fitGapStatus: 'emerging',
    notes: 'Admission gate is active; durable certification output is partial.',
  },
  {
    gateId: 'RCG03_WORKBENCH_EVIDENCE_CERTIFICATION',
    stageId: 'RS04_WORKBENCH_LOAD',
    gateName: 'Workbench Evidence Certification',
    requiredInputArtifacts: ['revise_queue_v1', 'revision_opportunity_ledger_v1'],
    requiredChecks: ['anchor resolves in source manuscript', 'diagnostic fields populated', 'mode contract present'],
    outputArtifact: 'workbench_opportunity_v1',
    blockingFailureCodes: ['WORKBENCH_ANCHOR_UNRESOLVABLE', 'WORKBENCH_DIAGNOSTIC_INCOMPLETE', 'WORKBENCH_MODE_CONTRACT_MISSING'],
    certificationStatus: 'emerging',
    fitGapStatus: 'emerging',
    notes: 'Workbench hydration is active; explicit evidence certification artifact is future work.',
  },
  {
    gateId: 'RCG04_CANDIDATE_SET_CERTIFICATION',
    stageId: 'RS05_CANDIDATE_GENERATION',
    gateName: 'Candidate Set Certification',
    requiredInputArtifacts: ['workbench_opportunity_v1', 'revision_mode_contract_v1'],
    requiredChecks: ['candidate_text non-empty', 'candidate does not duplicate original', 'voice gate passes', 'canon gate passes'],
    outputArtifact: 'revision_candidate_set_v1',
    blockingFailureCodes: ['CANDIDATE_GENERATION_FAILED', 'CANDIDATE_VOICE_GATE_FAIL', 'CANDIDATE_CANON_GATE_FAIL', 'CANDIDATE_DUPLICATES_ORIGINAL'],
    certificationStatus: 'partial',
    fitGapStatus: 'emerging',
    notes: 'Candidate generation and gates exist; persistent candidate certification is not yet formalized.',
  },
  {
    gateId: 'RCG05_AUTHOR_DECISION_CERTIFICATION',
    stageId: 'RS06_AUTHOR_DECISION',
    gateName: 'Author Decision Certification',
    requiredInputArtifacts: ['workbench_opportunity_v1', 'revision_candidate_set_v1'],
    requiredChecks: ['decision canonical', 'custom decision has custom_text', 'UI does not preselect or fabricate author action'],
    outputArtifact: 'author_decision_v1',
    blockingFailureCodes: ['DECISION_INVALID_VALUE', 'DECISION_MISSING_OPPORTUNITY', 'DECISION_CUSTOM_EMPTY'],
    certificationStatus: 'partial',
    fitGapStatus: 'emerging',
    notes: 'Local decision capture exists; formal decision certification occurs at ledger sync.',
  },
  {
    gateId: 'RCG06_LEDGER_SYNC_CERTIFICATION',
    stageId: 'RS07_LEDGER_SYNC',
    gateName: 'Append-Only Ledger Sync Certification',
    requiredInputArtifacts: ['author_decision_v1'],
    requiredChecks: ['decision canonical before write', 'local_id unique', 'undo references valid undone_local_id', 'existing rows not mutated'],
    outputArtifact: 'revision_ledger_decision_v1',
    blockingFailureCodes: ['LEDGER_SYNC_VALIDATION_FAIL', 'LEDGER_SYNC_DB_ERROR', 'LEDGER_SYNC_DUPLICATE_LOCAL_ID'],
    certificationStatus: 'partial',
    fitGapStatus: 'gap',
    notes: 'Append-only doctrine exists; formal no-mutation audit is a gap.',
  },
  {
    gateId: 'RCG07_COMPLETION_CERTIFICATION',
    stageId: 'RS08_COMPLETION',
    gateName: 'Revision Completion Certification',
    requiredInputArtifacts: ['revision_ledger_decision_v1', 'revise_queue_v1'],
    requiredChecks: ['decided_count equals total_ready', 'no pending sync entries', 'completion_type canonical'],
    outputArtifact: 'revision_completion_record_v1',
    blockingFailureCodes: ['COMPLETION_PREMATURE', 'COMPLETION_PENDING_SYNC', 'COMPLETION_CERT_INVALID'],
    certificationStatus: 'certified',
    fitGapStatus: 'proven',
    notes: 'Runtime certifier is active before Final Review apply/export. Successful certification persists revision_completion_record_v1 as a canonical evaluation artifact; failure_diagnosis_v1 metadata blocks premature completion.',
  },
  {
    gateId: 'RCG08_TRUSTEDPATH_CERTIFICATION',
    stageId: 'RS10_TRUSTEDPATH',
    gateName: 'TrustedPath Eligibility and Auto-Apply Certification',
    requiredInputArtifacts: ['repair_cross_check_v1', 'revision_opportunity_ledger_v1'],
    requiredChecks: ['verdict=approve only', 'finding not already decided', 'source manuscript not mutated', 'ledger decision written as accepted_a'],
    outputArtifact: 'trustedpath_result_v1',
    blockingFailureCodes: ['TRUSTEDPATH_INELIGIBLE_VERDICT', 'TRUSTEDPATH_ALREADY_DECIDED', 'TRUSTEDPATH_LEDGER_WRITE_FAIL'],
    certificationStatus: 'partial',
    fitGapStatus: 'emerging',
    notes: 'TrustedPath applies approved Option A repairs only. All non-approve verdicts route to manual review.',
  },
];

// ─── Author Decision State Machine ───────────────────────────────────────────

export type AuthorDecisionState =
  | 'pending'
  | 'accepted_a'
  | 'accepted_b'
  | 'accepted_c'
  | 'custom'
  | 'keep_original'
  | 'reject'
  | 'deferred';

export type QueueItemLifecycleState =
  | 'queued'
  | 'ready_for_revise'
  | 'needs_targeting'
  | 'in_review'
  | 'decided'
  | 'synced'
  | 'trustedpath_applied'
  | 'deferred';

export const AUTHOR_DECISION_TRANSITIONS: Record<AuthorDecisionState, readonly AuthorDecisionState[]> = {
  pending: ['accepted_a', 'accepted_b', 'accepted_c', 'custom', 'keep_original', 'reject', 'deferred'],
  accepted_a: ['reject', 'keep_original', 'deferred'],
  accepted_b: ['reject', 'keep_original', 'deferred'],
  accepted_c: ['reject', 'keep_original', 'deferred'],
  custom: ['reject', 'keep_original', 'deferred'],
  keep_original: ['accepted_a', 'accepted_b', 'accepted_c', 'custom', 'reject', 'deferred'],
  reject: ['accepted_a', 'accepted_b', 'accepted_c', 'custom', 'keep_original', 'deferred'],
  deferred: ['accepted_a', 'accepted_b', 'accepted_c', 'custom', 'keep_original', 'reject'],
};

export const QUEUE_ITEM_LIFECYCLE_TRANSITIONS: Record<QueueItemLifecycleState, readonly QueueItemLifecycleState[]> = {
  queued: ['ready_for_revise', 'needs_targeting'],
  ready_for_revise: ['in_review'],
  needs_targeting: ['ready_for_revise', 'deferred'],
  in_review: ['decided'],
  decided: ['synced'],
  synced: ['trustedpath_applied'],
  trustedpath_applied: [],
  deferred: ['ready_for_revise'],
};
