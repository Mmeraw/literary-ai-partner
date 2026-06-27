/**
 * Agent Readiness Package — Executable SIPOC/FIPOC Registry
 *
 * Machine-checkable source of truth for the Agent Readiness Package workflow:
 * manuscript eligibility → section generation → quality gate →
 * author review → package assembly → export.
 *
 * Governance: docs/SIPOC_AGENT_READINESS_PROCESS.md
 * Authority:  AI_GOVERNANCE.md (binding)
 *
 * Section canonical values:
 *   query_letter | what_makes_unique | synopsis | query_pitch | comparables | author_bio
 *
 * Section status canonical values:  draft | approved
 * Package status canonical values:  Not Started | Draft | Approved | Exported
 * Generate mode canonical values:   generate | regenerate | improve
 * Export format canonical values:   txt | docx
 */

// ─── Shared Enumerations ────────────────────────────────────────────────────

export type AgentReadinessActiveState =
  | 'active'
  | 'planned_required'
  | 'deferred';

export type AgentReadinessCertificationStatus =
  | 'proven'
  | 'partial'
  | 'emerging'
  | 'missing_critical';

export type AgentReadinessFitGapStatus = 'ok' | 'gap' | 'critical';

export type SectionType =
  | 'query_letter'
  | 'what_makes_unique'
  | 'synopsis'
  | 'query_pitch'
  | 'comparables'
  | 'author_bio';

export type SectionStatus = 'draft' | 'approved';

export type PackageStatus = 'Not Started' | 'Draft' | 'Approved' | 'Exported';

export type GenerateMode = 'generate' | 'regenerate' | 'improve';

export type ExportFormat = 'txt' | 'docx';

export type AgentReadinessAuthorityFamily =
  | 'governance'
  | 'doctrine'
  | 'contract'
  | 'gold_standard'
  | 'rubric';

// ─── Process Registry ───────────────────────────────────────────────────────

export interface AgentReadinessProcessEntry {
  sequence: number;
  stageId: string;
  processName: string;
  activeState: AgentReadinessActiveState;
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
  failureCodes: string[];
  consumers: string[];
  uiExposed: boolean;
  certificationStatus: AgentReadinessCertificationStatus;
  fitGapStatus: AgentReadinessFitGapStatus;
  notes: string;
}

export const AGENT_READINESS_PROCESS_REGISTRY: readonly AgentReadinessProcessEntry[] = [
  {
    sequence: 1,
    stageId: 'AR01_MANUSCRIPT_ELIGIBILITY',
    processName: 'Manuscript Eligibility Gate',
    activeState: 'active',
    supplier: 'Author (URL context or dashboard default)',
    inputArtifacts: ['evaluation_job_record_v1'],
    inputRequiredFields: ['manuscriptId', 'evaluationJobId', 'status'],
    inputMetrics: ['eligible_manuscript_count', 'latest_completed_evaluation_date'],
    codeSurfaces: ['app/agent-readiness/page.tsx', 'lib/dashboard/getDashboardEvaluations.ts'],
    processContract: 'Only evaluations with status ≠ running, failed, queued, canceled, incomplete are eligible. Sort by latest completed date first. If no eligible manuscript exists, render blocked state with guidance.',
    outputArtifacts: ['manuscript_context_v1'],
    outputRequiredFields: ['manuscriptId', 'evaluationJobId', 'manuscriptTitle', 'packageStatus'],
    outputMetrics: ['eligible_count', 'selected_manuscript_readiness_score'],
    forwardKick: 'AR02_SECTION_GENERATION',
    backwardKick: 'none — blocked state rendered if no eligible manuscript',
    dirtyDataRules: [
      'Exclude failed evaluations from eligible list.',
      'Exclude running and queued evaluations.',
      'evaluationJobId must be a valid UUID present in the evaluation_jobs table.',
    ],
    failureCodes: ['INELIGIBLE_MANUSCRIPT', 'MISSING_CONTEXT', 'NO_COMPLETED_EVALUATION'],
    consumers: ['AR02_SECTION_GENERATION', 'AR07_BATCH_GENERATION (batch shortcut passes manuscriptId+evaluationJobId downstream to AR02)'],
    uiExposed: true,
    certificationStatus: 'proven',
    fitGapStatus: 'ok',
    notes: 'URL params (manuscriptId, evaluationJobId) override dashboard default. Dashboard default = latest completed evaluation.',
  },
  {
    sequence: 2,
    stageId: 'AR02_SECTION_GENERATION',
    processName: 'Section Generation (AI)',
    activeState: 'active',
    supplier: 'Author (section choice + mode) via /agent-readiness/<section> pages',
    inputArtifacts: ['manuscript_context_v1', 'section_generation_request_v1', 'gold_standard_v1'],
    inputRequiredFields: ['manuscriptId', 'evaluationJobId', 'section', 'mode'],
    inputMetrics: ['token_count_input', 'generation_latency_ms'],
    codeSurfaces: [
      'app/api/agent-readiness/generate/route.ts',
      'app/api/agent-readiness/generate-all/route.ts',
    ],
    processContract: 'Call OpenAI GPT-4o with certified evaluation/revise context and gold standard prompts. Agent Readiness may package certified artifacts but must not reinterpret UED, Revise ledger, scores, recommendations, or business rules. Apply word limits per section (10% tolerance band on all limits). Mode: generate (fresh) | regenerate (discard prior) | improve (refine existing). Sections: query_letter (≤450w), what_makes_unique (≤150w), synopsis (query 100-150w, standard 250-500w, extended 700-1000w), query_pitch (≤75w), comparables (≤200w), author_bio (≤200w). Author bio requires authorBioInput; system must shape only supplied facts — never invent credentials.',
    outputArtifacts: ['section_generation_result_v1'],
    outputRequiredFields: ['content', 'wordCount', 'section'],
    outputMetrics: ['word_count', 'generation_latency_ms'],
    forwardKick: 'AR03_QUALITY_GATE',
    backwardKick: 'none — new generation attempt on retry',
    dirtyDataRules: [
      'author_bio generation is blocked if authorBioInput is absent or < 50 chars.',
      'generate-all generates 5 core sections; author_bio only if authorBioInput provided.',
      'Sections generated sequentially in: query_pitch → what_makes_unique → synopsis → comparables → query_letter.',
      'Web/PDF/DOCX/TXT renderer output and evaluation_report_view_model_v1 are forbidden as Agent Readiness authority.',
    ],
    failureCodes: ['UNAUTHENTICATED', 'MISSING_CONTEXT', 'INELIGIBLE_MANUSCRIPT', 'GENERATION_TIMEOUT'],
    consumers: ['AR03_QUALITY_GATE'],
    uiExposed: false,
    certificationStatus: 'proven',
    fitGapStatus: 'ok',
    notes: 'Model is configurable via AGENT_READINESS_MODEL env var (default gpt-4o). maxDuration=60s. TIMEOUT_MS=45_000.',
  },
  {
    sequence: 3,
    stageId: 'AR03_QUALITY_GATE',
    processName: 'Section Quality Gate',
    activeState: 'active',
    supplier: 'AR02_SECTION_GENERATION output',
    inputArtifacts: ['section_generation_result_v1'],
    inputRequiredFields: ['content', 'wordCount', 'section'],
    inputMetrics: ['quality_gate_pass_rate', 'rejection_reason_distribution'],
    codeSurfaces: ['app/api/agent-readiness/generate/route.ts'],
    processContract: 'Reject output if: text < 20 chars; contains editorial meta-language patterns; contains unresolved placeholder patterns ([Author Name], [Title], etc.); word count > limit × 1.1; word count < section minimum. Pass criteria must all hold simultaneously.',
    outputArtifacts: ['quality_gate_result_v1'],
    outputRequiredFields: ['qualityGatePass', 'section'],
    outputMetrics: ['gate_pass_rate', 'rejection_reason_frequency'],
    forwardKick: 'AR04_SECTION_PERSISTENCE (on pass)',
    backwardKick: 'AR02_SECTION_GENERATION (on fail — client must retry)',
    dirtyDataRules: [
      'Do not persist any section that fails the quality gate.',
      'qualityGateReason must be set on failure and must not be exposed as a user-facing error without sanitisation.',
    ],
    failureCodes: [
      'OUTPUT_TOO_SHORT',
      'EDITORIAL_META_LANGUAGE',
      'UNRESOLVED_PLACEHOLDER',
      'WORD_LIMIT_EXCEEDED',
      'OUTPUT_TOO_THIN',
    ],
    consumers: ['AR04_SECTION_PERSISTENCE'],
    uiExposed: false,
    certificationStatus: 'proven',
    fitGapStatus: 'ok',
    notes: 'Word minimums: query_letter ≥200w, synopsis ≥150w, author_bio ≥50w, what_makes_unique ≥60w. query_pitch and comparables have no minimum.',
  },
  {
    sequence: 4,
    stageId: 'AR04_SECTION_PERSISTENCE',
    processName: 'Section Persistence',
    activeState: 'active',
    supplier: 'AR03_QUALITY_GATE (pass)',
    inputArtifacts: ['quality_gate_result_v1', 'section_generation_result_v1', 'manuscript_context_v1'],
    inputRequiredFields: ['content', 'section', 'manuscriptId', 'user_id', 'qualityGatePass'],
    inputMetrics: ['sections_persisted_total', 'db_write_latency_ms'],
    codeSurfaces: ['app/api/agent-readiness/generate/route.ts'],
    processContract: 'Upsert section record to agent_readiness_sections table with status=draft. Keyed by (user_id, manuscript_id, section_type). Must not persist if quality gate did not pass.',
    outputArtifacts: ['agent_readiness_section_v1'],
    outputRequiredFields: ['section_type', 'content', 'status', 'manuscript_id', 'user_id'],
    outputMetrics: ['upsert_success_rate', 'sections_in_draft_count'],
    forwardKick: 'AR05_AUTHOR_REVIEW',
    backwardKick: 'Returns HTTP 500 on DB write failure — client must retry.',
    dirtyDataRules: [
      'Never write a section with status=approved at generation time — approval is an explicit author action.',
      'DB write failure (saveError) returns HTTP 500 and does NOT return generated content. The author must retry the generation.',
    ],
    failureCodes: ['UNAUTHENTICATED', 'DB_WRITE_FAILURE', 'QUALITY_GATE_NOT_PASSED'],
    consumers: ['AR05_AUTHOR_REVIEW', 'AR06_COMPLETENESS_CHECK'],
    uiExposed: false,
    certificationStatus: 'proven',
    fitGapStatus: 'ok',
    notes: 'DB persistence failure returns HTTP 500. generate/route.ts catches saveError and returns 500 with error message — generated content is NOT returned to the author. Upsert conflict key: (user_id, manuscript_id, section_type). Regeneration overwrites existing draft.'
  },
  {
    sequence: 5,
    stageId: 'AR05_AUTHOR_REVIEW',
    processName: 'Author Review & Section Approval',
    activeState: 'active',
    supplier: 'Author',
    inputArtifacts: ['agent_readiness_section_v1'],
    inputRequiredFields: ['section_type', 'content', 'status'],
    inputMetrics: ['section_approval_rate', 'sections_approved_count'],
    codeSurfaces: [
      'app/agent-readiness/query-letter/page.tsx',
      'app/agent-readiness/synopsis/page.tsx',
      'app/agent-readiness/pitch/page.tsx',
      'app/agent-readiness/bio/page.tsx',
      'app/agent-readiness/comparables/page.tsx',
      'app/agent-readiness/AgentReadinessClient.tsx',
    ],
    processContract: 'Author may read, edit, or approve each section. Author bio must reflect only author-supplied facts — system must not invent credentials, awards, education, platform, or personal history.',
    outputArtifacts: ['author_review_decision_v1'],
    outputRequiredFields: ['section_type', 'decision'],
    outputMetrics: ['sections_approved_count', 'sections_deferred_count'],
    forwardKick: 'AR06_COMPLETENESS_CHECK',
    backwardKick: 'AR02_SECTION_GENERATION (on regenerate request)',
    dirtyDataRules: [
      'Author bio must not contain AI-invented facts. Only shape author-supplied input.',
      'Section approval calls POST /api/agent-readiness/sections/approve which writes status=approved to DB and persists an audit record.',
    ],
    failureCodes: ['UNAUTHENTICATED', 'SECTION_NOT_FOUND'],
    consumers: ['AR06_COMPLETENESS_CHECK'],
    uiExposed: true,
    certificationStatus: 'proven',
    fitGapStatus: 'ok',
    notes: 'Section approval persisted via POST /api/agent-readiness/sections/approve. Updates agent_readiness_sections.status to approved and writes audit record to agent_readiness_author_review_decisions. Returns 500 on DB error.',
  },
  {
    sequence: 6,
    stageId: 'AR06_COMPLETENESS_CHECK',
    processName: 'Package Completeness Check',
    activeState: 'active',
    supplier: 'System (derived from agent_readiness_sections in DB, or client sectionStates)',
    inputArtifacts: ['agent_readiness_section_v1'],
    inputRequiredFields: ['section_type', 'status', 'manuscript_id', 'user_id'],
    inputMetrics: ['approved_section_count', 'completeness_ratio'],
    codeSurfaces: ['app/agent-readiness/page.tsx', 'app/agent-readiness/AgentReadinessClient.tsx'],
    processContract: 'All 6 canonical sections must have status=approved in agent_readiness_sections before export is permitted. The download route reads only approved sections from DB and blocks assembly if any are missing.',
    outputArtifacts: ['package_completeness_result_v1'],
    outputRequiredFields: ['allSectionsApproved', 'approvedCount', 'manuscript_id'],
    outputMetrics: ['completeness_ratio', 'blocked_assembly_count'],
    forwardKick: 'AR08_EXPORT (when all 6 approved)',
    backwardKick: 'AR05_AUTHOR_REVIEW (when any section not yet approved)',
    dirtyDataRules: [
      'Download/export is gated on all 6 sections having status=approved in DB.',
      'Export route returns HTTP 422 with missingSections if completeness check fails.',
    ],
    failureCodes: ['SECTIONS_NOT_ALL_APPROVED'],
    consumers: ['AR08_EXPORT'],
    uiExposed: true,
    certificationStatus: 'proven',
    fitGapStatus: 'ok',
    notes: 'Download route reads approved sections from DB (status=approved). assemblePackage() returns ok=false with missingSections if any of the 6 required sections are not approved. HTTP 422 blocks export.',
  },
  {
    sequence: 7,
    stageId: 'AR07_BATCH_GENERATION',
    processName: 'Batch Section Generation (generate-all)',
    activeState: 'active',
    supplier: 'Author (one-click generate-all action)',
    inputArtifacts: ['manuscript_context_v1', 'section_generation_request_v1', 'gold_standard_v1'],
    inputRequiredFields: ['manuscriptId', 'evaluationJobId'],
    inputMetrics: ['sections_generated_count', 'batch_latency_ms'],
    codeSurfaces: ['app/api/agent-readiness/generate-all/route.ts'],
    processContract: 'Orchestrate sequential generation of 5 core sections (query_pitch → what_makes_unique → synopsis → comparables → query_letter) by calling AR02_SECTION_GENERATION for each. Author bio generated only if authorBioInput provided and ≥50 chars. Returns draft results inline; each section goes through AR03 quality gate and AR04 persistence individually. This stage does NOT assemble or approve sections — it is a batch shortcut for AR02×5.',
    outputArtifacts: ['section_generation_result_v1'],
    outputRequiredFields: ['content', 'wordCount', 'section'],
    outputMetrics: ['sections_generated_count', 'sections_with_errors'],
    forwardKick: 'AR03_QUALITY_GATE (per section)',
    backwardKick: 'none — per-section errors are non-fatal to other sections',
    dirtyDataRules: [
      'generate-all does NOT produce an assembled package or set packageStatus=Approved.',
      'Per-section errors must not block other sections from generating.',
      'author_bio is only generated if authorBioInput is present and ≥50 chars.',
    ],
    failureCodes: ['UNAUTHENTICATED', 'MISSING_CONTEXT'],
    consumers: ['AR03_QUALITY_GATE', 'AR04_SECTION_PERSISTENCE'],
    uiExposed: true,
    certificationStatus: 'proven',
    fitGapStatus: 'ok',
    notes: 'This is a convenience orchestration of AR02×5, not a distinct assembly pipeline stage. It returns draft content only. Package assembly and section approval are separate downstream author steps.',
  },
  {
    sequence: 8,
    stageId: 'AR08_EXPORT',
    processName: 'Package Export (Assembly + Download)',
    activeState: 'active',
    supplier: 'Author (explicit download action via AgentReadinessClient)',
    inputArtifacts: ['agent_readiness_package_v1'],
    inputRequiredFields: ['manuscriptTitle', 'sections', 'format'],
    inputMetrics: ['export_download_count', 'format_distribution'],
    codeSurfaces: ['app/api/agent-readiness/download/route.ts', 'app/agent-readiness/AgentReadinessClient.tsx'],
    processContract: 'Assemble and export package in one step. The download route takes manuscriptTitle, format, and sections inline from the client (not from DB). ACTUAL GATE: requires manuscriptTitle + at least one section (Object.keys(sections).length > 0). It does NOT require all 6 sections, does NOT check section approval status, and does NOT read from the DB. Missing sections are silently skipped in canonical order. Package assembly must use Agent Readiness section artifacts and certified Evaluation/Revise lineage only; Web/PDF/DOCX/TXT renderer output and evaluation_report_view_model_v1 are invalid package authority. Canonical section order in output: query_pitch → query_letter → what_makes_unique → synopsis → comparables → author_bio. Output format: .txt (plain text with dividers) or .docx (Word 2003 XML). Export must not imply agent interest, representation, publication, sales, or market outcome. NOTE: this is both the assembly and export step — there is no separate DB-persisted package assembly record.',
    outputArtifacts: ['package_export_v1'],
    outputRequiredFields: ['content', 'format', 'filename'],
    outputMetrics: ['export_file_size_bytes', 'export_latency_ms'],
    forwardKick: 'none — terminal export stage',
    backwardKick: 'none — missing sections are silently skipped, not a kick',
    dirtyDataRules: [
      'Format must be exactly txt or docx — no other values accepted.',
      'Export must not contain fabricated agent names, offer language, or market claims.',
      'Export/package assembly must not consume Web/PDF/DOCX/TXT renderer output or evaluation_report_view_model_v1.',
      'KNOWN GAP: export does not enforce that all 6 sections are present or approved. A package with 1 section can be exported. Full enforcement (requiring all 6 approved sections) is a planned required gate, not currently implemented.',
    ],
    failureCodes: ['INVALID_FORMAT', 'MISSING_SECTIONS', 'UNAUTHENTICATED', 'AGENT_PACKAGE_RENDERER_OUTPUT_INVALID'],
    consumers: ['Author (file download)'],
    uiExposed: true,
    certificationStatus: 'partial',
    fitGapStatus: 'gap',
    notes: 'KNOWN GAP: download route accepts any non-empty sections map. It does not validate approval status or enforce completeness. The UI gates the download CTA on allSectionsStarted (all 6 have drafts), but this is a client-side check only — the API itself has no such enforcement. Additional export targets (Copy Query Package, Save Package Version) are in doctrine scope but not yet implemented.'
  },
  {
    sequence: 9,
    stageId: 'AR09_HISTORY',
    processName: 'Package History',
    activeState: 'planned_required',
    supplier: 'System (package records)',
    inputArtifacts: ['agent_readiness_package_v1'],
    inputRequiredFields: ['manuscript_id', 'user_id', 'packageStatus'],
    inputMetrics: ['package_versions_count', 'history_view_frequency'],
    codeSurfaces: ['app/agent-readiness/history/page.tsx'],
    processContract: 'Display previous package versions per manuscript. Supports audit trail and re-export. Future: bind to persistent package record keyed by (user_id, manuscript_id, package_id).',
    outputArtifacts: ['package_history_record_v1'],
    outputRequiredFields: ['manuscript_id', 'user_id', 'created_at', 'packageStatus'],
    outputMetrics: ['history_record_count'],
    forwardKick: 'none — read-only view stage',
    backwardKick: 'none',
    dirtyDataRules: [
      'History must not show packages from other users.',
      'History is read-only — no edits may originate from this stage.',
    ],
    failureCodes: ['UNAUTHENTICATED', 'NO_PACKAGE_HISTORY'],
    consumers: ['Author (read-only view)'],
    uiExposed: true,
    certificationStatus: 'missing_critical',
    fitGapStatus: 'critical',
    notes: 'Package persistence is a known future seam. Until package records exist, history page is a placeholder.',
  },
] as const;

// ─── Artifact Registry ──────────────────────────────────────────────────────

export interface AgentReadinessArtifactEntry {
  artifact: string;
  producerStageId: string;
  consumerStageIds: string[];
  requiredFields: string[];
  completenessMetric: string;
  accuracyMetric: string;
  dirtyDataRule: string;
  regenerationOwnerStageId: string;
  requiredForPackageAssembly: boolean;
  fitGapStatus: AgentReadinessFitGapStatus;
}

export const AGENT_READINESS_ARTIFACT_REGISTRY: readonly AgentReadinessArtifactEntry[] = [
  {
    artifact: 'evaluation_job_record_v1',
    producerStageId: 'EVALUATION_PIPELINE (external)',
    consumerStageIds: ['AR01_MANUSCRIPT_ELIGIBILITY', 'AR02_SECTION_GENERATION'],
    requiredFields: ['manuscriptId', 'evaluationJobId', 'status', 'manuscriptTitle'],
    completenessMetric: 'status field present and in canonical set',
    accuracyMetric: 'status accurately reflects evaluation pipeline state',
    dirtyDataRule: 'Only records with status ≠ running/failed/queued/canceled/incomplete are eligible.',
    regenerationOwnerStageId: 'EVALUATION_PIPELINE (external)',
    requiredForPackageAssembly: false,
    fitGapStatus: 'ok',
  },
  {
    artifact: 'manuscript_context_v1',
    producerStageId: 'AR01_MANUSCRIPT_ELIGIBILITY',
    consumerStageIds: ['AR02_SECTION_GENERATION', 'AR07_BATCH_GENERATION', 'AR06_COMPLETENESS_CHECK'],
    requiredFields: ['manuscriptId', 'evaluationJobId', 'manuscriptTitle', 'packageStatus'],
    completenessMetric: 'all 4 required fields present',
    accuracyMetric: 'manuscriptId and evaluationJobId reference valid DB records',
    dirtyDataRule: 'Must not be constructed from failed or running evaluations.',
    regenerationOwnerStageId: 'AR01_MANUSCRIPT_ELIGIBILITY',
    requiredForPackageAssembly: true,
    fitGapStatus: 'ok',
  },
  {
    artifact: 'section_generation_request_v1',
    producerStageId: 'AR02_SECTION_GENERATION',
    consumerStageIds: ['AR02_SECTION_GENERATION'],
    requiredFields: ['manuscriptId', 'evaluationJobId', 'section', 'mode'],
    completenessMetric: 'section is canonical SectionType; mode is canonical GenerateMode',
    accuracyMetric: 'authorBioInput ≥ 50 chars when section = author_bio',
    dirtyDataRule: 'author_bio generation must be blocked if authorBioInput absent or < 50 chars.',
    regenerationOwnerStageId: 'AR02_SECTION_GENERATION',
    requiredForPackageAssembly: false,
    fitGapStatus: 'ok',
  },
  {
    artifact: 'section_generation_result_v1',
    producerStageId: 'AR02_SECTION_GENERATION',
    consumerStageIds: ['AR03_QUALITY_GATE'],
    requiredFields: ['content', 'wordCount', 'section'],
    completenessMetric: 'content is non-empty string; wordCount > 0',
    accuracyMetric: 'wordCount computed correctly from content',
    dirtyDataRule: 'Must not be persisted before passing quality gate.',
    regenerationOwnerStageId: 'AR02_SECTION_GENERATION',
    requiredForPackageAssembly: false,
    fitGapStatus: 'ok',
  },
  {
    artifact: 'quality_gate_result_v1',
    producerStageId: 'AR03_QUALITY_GATE',
    consumerStageIds: ['AR04_SECTION_PERSISTENCE'],
    requiredFields: ['qualityGatePass', 'section'],
    completenessMetric: 'qualityGatePass boolean present',
    accuracyMetric: 'all gate checks applied correctly per section type',
    dirtyDataRule: 'qualityGateReason must be set when qualityGatePass=false.',
    regenerationOwnerStageId: 'AR03_QUALITY_GATE',
    requiredForPackageAssembly: false,
    fitGapStatus: 'ok',
  },
  {
    artifact: 'agent_readiness_section_v1',
    producerStageId: 'AR04_SECTION_PERSISTENCE',
    consumerStageIds: ['AR05_AUTHOR_REVIEW', 'AR06_COMPLETENESS_CHECK', 'AR07_BATCH_GENERATION'],
    requiredFields: ['section_type', 'content', 'status', 'manuscript_id', 'user_id'],
    completenessMetric: 'all 5 required fields present; status in {draft, approved}',
    accuracyMetric: 'content passed quality gate at generation time',
    dirtyDataRule: 'DB write failure returns HTTP 500 — content is NOT returned to the author. status must not be set to approved at generation time.',
    regenerationOwnerStageId: 'AR04_SECTION_PERSISTENCE',
    requiredForPackageAssembly: true,
    fitGapStatus: 'ok',
  },
  {
    artifact: 'author_review_decision_v1',
    producerStageId: 'AR05_AUTHOR_REVIEW',
    consumerStageIds: ['AR06_COMPLETENESS_CHECK'],
    requiredFields: ['section_type', 'decision'],
    completenessMetric: 'decision captured in client state per section',
    accuracyMetric: 'decision reflects explicit author action — not inferred or preselected',
    dirtyDataRule: 'Approval decision persisted via POST /api/agent-readiness/sections/approve. Author bio decision must not override user-supplied facts with invented content.',
    regenerationOwnerStageId: 'AR05_AUTHOR_REVIEW',
    requiredForPackageAssembly: false,
    fitGapStatus: 'ok',
  },
  {
    artifact: 'package_completeness_result_v1',
    producerStageId: 'AR06_COMPLETENESS_CHECK',
    consumerStageIds: ['AR08_EXPORT'],
    requiredFields: ['allSectionsApproved', 'approvedCount', 'manuscript_id'],
    completenessMetric: 'approvedCount from DB (sections with status=approved); allSectionsApproved = approvedCount === 6',
    accuracyMetric: 'allSectionsApproved derived from DB state via download route query (status=approved).',
    dirtyDataRule: 'Must not assert allSectionsApproved=true with approvedCount < 6. Export returns HTTP 422 if any section is not approved.',
    regenerationOwnerStageId: 'AR06_COMPLETENESS_CHECK',
    requiredForPackageAssembly: true,
    fitGapStatus: 'ok',
  },
  {
    artifact: 'agent_readiness_package_v1',
    producerStageId: 'AR08_EXPORT',
    consumerStageIds: ['AR09_HISTORY', 'STORYGATE_VALIDATION'],
    requiredFields: ['manuscriptTitle', 'sections', 'format'],
    completenessMetric: 'sections map contains content for all 6 canonical section keys',
    accuracyMetric: 'section content passed quality gate at generation time',
    dirtyDataRule: 'KNOWN GAP: package is assembled inline by download route from client-supplied sections, not from DB records. No persisted package record exists. sections may include content that was never formally approved by the author.',
    regenerationOwnerStageId: 'AR08_EXPORT',
    requiredForPackageAssembly: true,
    fitGapStatus: 'critical',
  },
  {
    artifact: 'creator_approval_v1',
    producerStageId: 'AR08_EXPORT',
    consumerStageIds: ['STORYGATE_VALIDATION'],
    requiredFields: ['approval_state', 'approved', 'manuscript_id', 'evaluation_job_id', 'package_hash'],
    completenessMetric: 'approval_state present and approved boolean agrees with approval_state',
    accuracyMetric: 'approval reflects explicit creator action; never inferred from generated or exported package content',
    dirtyDataRule: 'Storygate submission must be blocked unless approval_state=approved and approved=true. Missing, pending, or rejected approval produces failure_diagnosis_v1 and must not submit.',
    regenerationOwnerStageId: 'AR08_EXPORT',
    requiredForPackageAssembly: false,
    fitGapStatus: 'gap',
  },
  {
    artifact: 'package_export_v1',
    producerStageId: 'AR08_EXPORT',
    consumerStageIds: ['Author (file download)'],
    requiredFields: ['content', 'format', 'filename'],
    completenessMetric: 'content non-empty; format is txt or docx',
    accuracyMetric: 'file content matches assembled package exactly',
    dirtyDataRule: 'format must be exactly txt or docx. No other values accepted.',
    regenerationOwnerStageId: 'AR08_EXPORT',
    requiredForPackageAssembly: false,
    fitGapStatus: 'ok',
  },
  {
    artifact: 'gold_standard_v1',
    producerStageId: 'lib/agent-readiness/gold-standards (static)',
    consumerStageIds: ['AR02_SECTION_GENERATION'],
    requiredFields: ['section_type', 'rubric', 'examples'],
    completenessMetric: 'gold standard file present on disk for relevant section types',
    accuracyMetric: 'rubric aligns with current DREAM benchmark contract',
    dirtyDataRule: 'Gold standard files must not be modified without a governance review.',
    regenerationOwnerStageId: 'lib/agent-readiness/gold-standards (static)',
    requiredForPackageAssembly: false,
    fitGapStatus: 'ok',
  },
  {
    artifact: 'package_history_record_v1',
    producerStageId: 'AR09_HISTORY',
    consumerStageIds: ['Author (read-only view)'],
    requiredFields: ['manuscript_id', 'user_id', 'created_at', 'packageStatus'],
    completenessMetric: 'all 4 required fields present',
    accuracyMetric: 'packageStatus reflects actual assembly and export state',
    dirtyDataRule: 'History must not show packages from other users. Read-only — no writes from history stage.',
    regenerationOwnerStageId: 'none',
    requiredForPackageAssembly: false,
    fitGapStatus: 'critical',
  },
] as const;

// ─── Field Registry ─────────────────────────────────────────────────────────

export interface AgentReadinessFieldEntry {
  field: string;
  artifact: string;
  required: boolean;
  nullable: boolean;
  canonicalValues?: string[];
  sourceStageId: string;
  validatorStageId: string;
  uiRendered: boolean;
  notes: string;
}

export const AGENT_READINESS_FIELD_REGISTRY: readonly AgentReadinessFieldEntry[] = [
  {
    field: 'manuscriptId',
    artifact: 'manuscript_context_v1',
    required: true,
    nullable: false,
    sourceStageId: 'AR01_MANUSCRIPT_ELIGIBILITY',
    validatorStageId: 'AR01_MANUSCRIPT_ELIGIBILITY',
    uiRendered: true,
    notes: 'Numeric manuscript identifier. URL param overrides dashboard default.',
  },
  {
    field: 'evaluationJobId',
    artifact: 'manuscript_context_v1',
    required: true,
    nullable: false,
    sourceStageId: 'AR01_MANUSCRIPT_ELIGIBILITY',
    validatorStageId: 'AR01_MANUSCRIPT_ELIGIBILITY',
    uiRendered: false,
    notes: 'UUID of the evaluation job. Required for section generation prompts.',
  },
  {
    field: 'manuscriptTitle',
    artifact: 'manuscript_context_v1',
    required: true,
    nullable: false,
    sourceStageId: 'AR01_MANUSCRIPT_ELIGIBILITY',
    validatorStageId: 'AR01_MANUSCRIPT_ELIGIBILITY',
    uiRendered: true,
    notes: 'Displayed in Selected Manuscript panel and embedded in export document header.',
  },
  {
    field: 'packageStatus',
    artifact: 'manuscript_context_v1',
    required: true,
    nullable: false,
    canonicalValues: ['Not Started', 'Draft', 'Approved', 'Exported'],
    sourceStageId: 'AR06_COMPLETENESS_CHECK',
    validatorStageId: 'AR06_COMPLETENESS_CHECK',
    uiRendered: true,
    notes: 'Manuscript-specific. Transitions: Not Started → Draft (first section generated) → Approved (all 6 approved) → Exported (download completed).',
  },
  {
    field: 'section',
    artifact: 'section_generation_request_v1',
    required: true,
    nullable: false,
    canonicalValues: ['query_letter', 'what_makes_unique', 'synopsis', 'query_pitch', 'comparables', 'author_bio'],
    sourceStageId: 'AR02_SECTION_GENERATION',
    validatorStageId: 'AR02_SECTION_GENERATION',
    uiRendered: false,
    notes: 'Exactly 6 canonical values. No other section types permitted.',
  },
  {
    field: 'mode',
    artifact: 'section_generation_request_v1',
    required: true,
    nullable: false,
    canonicalValues: ['generate', 'regenerate', 'improve'],
    sourceStageId: 'AR02_SECTION_GENERATION',
    validatorStageId: 'AR02_SECTION_GENERATION',
    uiRendered: false,
    notes: 'generate = fresh; regenerate = discard prior and generate fresh; improve = refine existing content.',
  },
  {
    field: 'authorBioInput',
    artifact: 'section_generation_request_v1',
    required: false,
    nullable: true,
    sourceStageId: 'AR02_SECTION_GENERATION',
    validatorStageId: 'AR02_SECTION_GENERATION',
    uiRendered: true,
    notes: 'Required when section=author_bio. Minimum 50 chars. System shapes only supplied facts — must not invent credentials.',
  },
  {
    field: 'content',
    artifact: 'agent_readiness_section_v1',
    required: true,
    nullable: false,
    sourceStageId: 'AR04_SECTION_PERSISTENCE',
    validatorStageId: 'AR03_QUALITY_GATE',
    uiRendered: true,
    notes: 'Generated section text. Must pass quality gate before persistence.',
  },
  {
    field: 'wordCount',
    artifact: 'section_generation_result_v1',
    required: true,
    nullable: false,
    sourceStageId: 'AR02_SECTION_GENERATION',
    validatorStageId: 'AR03_QUALITY_GATE',
    uiRendered: true,
    notes: 'Computed from content split on whitespace. Used by quality gate to enforce limits and minimums.',
  },
  {
    field: 'status',
    artifact: 'agent_readiness_section_v1',
    required: true,
    nullable: false,
    canonicalValues: ['draft', 'approved'],
    sourceStageId: 'AR04_SECTION_PERSISTENCE',
    validatorStageId: 'AR05_AUTHOR_REVIEW',
    uiRendered: true,
    notes: 'Set to draft on persistence. Transitions to approved only by explicit author action.',
  },
  {
    field: 'format',
    artifact: 'package_export_v1',
    required: true,
    nullable: false,
    canonicalValues: ['txt', 'docx'],
    sourceStageId: 'AR08_EXPORT',
    validatorStageId: 'AR08_EXPORT',
    uiRendered: false,
    notes: 'Exactly 2 canonical values. No other export formats permitted.',
  },
  {
    field: 'qualityGatePass',
    artifact: 'quality_gate_result_v1',
    required: true,
    nullable: false,
    canonicalValues: ['true', 'false'],
    sourceStageId: 'AR03_QUALITY_GATE',
    validatorStageId: 'AR03_QUALITY_GATE',
    uiRendered: false,
    notes: 'Boolean. Must be true for section to proceed to persistence.',
  },
  {
    field: 'qualityGateReason',
    artifact: 'quality_gate_result_v1',
    required: false,
    nullable: true,
    sourceStageId: 'AR03_QUALITY_GATE',
    validatorStageId: 'AR03_QUALITY_GATE',
    uiRendered: false,
    notes: 'Populated on gate failure. Must not be directly exposed as raw DB/system error in client response.',
  },
  {
    field: 'user_id',
    artifact: 'agent_readiness_section_v1',
    required: true,
    nullable: false,
    sourceStageId: 'AR04_SECTION_PERSISTENCE',
    validatorStageId: 'AR02_SECTION_GENERATION',
    uiRendered: false,
    notes: 'Authenticated user ID from Supabase session. All write operations require authentication.',
  },
  {
    field: 'allSectionsApproved',
    artifact: 'package_completeness_result_v1',
    required: true,
    nullable: false,
    canonicalValues: ['true', 'false'],
    sourceStageId: 'AR06_COMPLETENESS_CHECK',
    validatorStageId: 'AR06_COMPLETENESS_CHECK',
    uiRendered: true,
    notes: 'true iff all 6 canonical section types have status=approved for this (user_id, manuscript_id).',
  },
  {
    field: 'approval_state',
    artifact: 'creator_approval_v1',
    required: true,
    nullable: false,
    canonicalValues: ['pending', 'approved', 'rejected'],
    sourceStageId: 'AR08_EXPORT',
    validatorStageId: 'AR08_EXPORT',
    uiRendered: true,
    notes: 'Creator approval state for Storygate handoff. Storygate accepts only approved.',
  },
  {
    field: 'approved',
    artifact: 'creator_approval_v1',
    required: true,
    nullable: false,
    canonicalValues: ['true', 'false'],
    sourceStageId: 'AR08_EXPORT',
    validatorStageId: 'AR08_EXPORT',
    uiRendered: false,
    notes: 'Boolean compatibility field. Must be true iff approval_state=approved.',
  },
] as const;

// ─── Kick Matrix ────────────────────────────────────────────────────────────

export interface AgentReadinessKickEntry {
  kickCode: string;
  detectedAt: string;
  description: string;
  blocking: boolean;
  blocksPackageAssembly: boolean;
  remediation: string;
  httpStatus: number;
}

export const AGENT_READINESS_KICK_MATRIX: readonly AgentReadinessKickEntry[] = [
  {
    kickCode: 'INELIGIBLE_MANUSCRIPT',
    detectedAt: 'AR01_MANUSCRIPT_ELIGIBILITY',
    description: 'Selected manuscript evaluation status is running, failed, queued, canceled, or incomplete.',
    blocking: true,
    blocksPackageAssembly: true,
    remediation: 'Author must wait for evaluation to complete or select a different manuscript.',
    httpStatus: 422,
  },
  {
    kickCode: 'NO_COMPLETED_EVALUATION',
    detectedAt: 'AR01_MANUSCRIPT_ELIGIBILITY',
    description: 'No eligible completed evaluation exists for the user. Cannot enter Agent Readiness workflow.',
    blocking: true,
    blocksPackageAssembly: true,
    remediation: 'Author must complete a manuscript evaluation before generating an Agent Readiness Package.',
    httpStatus: 422,
  },
  {
    kickCode: 'MISSING_CONTEXT',
    detectedAt: 'AR02_SECTION_GENERATION',
    description: 'manuscriptId or evaluationJobId missing from request.',
    blocking: true,
    blocksPackageAssembly: false,
    remediation: 'Client must supply both manuscriptId and evaluationJobId.',
    httpStatus: 400,
  },
  {
    kickCode: 'UNAUTHENTICATED',
    detectedAt: 'AR02_SECTION_GENERATION',
    description: 'Request has no valid authenticated user session.',
    blocking: true,
    blocksPackageAssembly: true,
    remediation: 'Author must log in before generating or assembling package sections.',
    httpStatus: 401,
  },
  {
    kickCode: 'OUTPUT_TOO_SHORT',
    detectedAt: 'AR03_QUALITY_GATE',
    description: 'Generated section text is fewer than 20 characters.',
    blocking: true,
    blocksPackageAssembly: false,
    remediation: 'Retry generation. If persistent, check model and prompt configuration.',
    httpStatus: 422,
  },
  {
    kickCode: 'EDITORIAL_META_LANGUAGE',
    detectedAt: 'AR03_QUALITY_GATE',
    description: 'Generated text contains editorial advisory phrasing (e.g., "the reader would benefit from", "consider adding").',
    blocking: true,
    blocksPackageAssembly: false,
    remediation: 'Retry generation. Review prompt to reinforce direct authorial voice.',
    httpStatus: 422,
  },
  {
    kickCode: 'UNRESOLVED_PLACEHOLDER',
    detectedAt: 'AR03_QUALITY_GATE',
    description: 'Generated text contains unresolved template placeholders (e.g., [Author Name], [Title]).',
    blocking: true,
    blocksPackageAssembly: false,
    remediation: 'Retry generation. Ensure evaluation context was loaded correctly.',
    httpStatus: 422,
  },
  {
    kickCode: 'WORD_LIMIT_EXCEEDED',
    detectedAt: 'AR03_QUALITY_GATE',
    description: 'Generated word count exceeds section limit by more than 10%.',
    blocking: true,
    blocksPackageAssembly: false,
    remediation: 'Retry generation with tighter constraint. Per-section limits (10% tolerance): query_letter 450, what_makes_unique 150, synopsis (query 150 / standard 500 / extended 1000), query_pitch 75, comparables 200, author_bio 200.',
    httpStatus: 422,
  },
  {
    kickCode: 'OUTPUT_TOO_THIN',
    detectedAt: 'AR03_QUALITY_GATE',
    description: 'Generated word count is below section minimum (query_letter <200, synopsis <150, author_bio <50, what_makes_unique <60).',
    blocking: true,
    blocksPackageAssembly: false,
    remediation: 'Retry generation. Check prompt depth and evaluation context completeness.',
    httpStatus: 422,
  },
  {
    kickCode: 'SECTIONS_NOT_ALL_APPROVED',
    detectedAt: 'AR06_COMPLETENESS_CHECK',
    description: 'Fewer than 6 canonical sections have status=approved. Package assembly blocked.',
    blocking: true,
    blocksPackageAssembly: true,
    remediation: 'Author must review and approve all 6 sections before assembling the package.',
    httpStatus: 422,
  },
  {
    kickCode: 'QUALITY_GATE_NOT_PASSED',
    detectedAt: 'AR08_EXPORT',
    description: 'Package assembly attempted from sections that failed quality gate requirements.',
    blocking: true,
    blocksPackageAssembly: true,
    remediation: 'Regenerate failed sections and pass AR03 quality gate before package export.',
    httpStatus: 422,
  },
  {
    kickCode: 'CREATOR_APPROVAL_REQUIRED',
    detectedAt: 'AR08_EXPORT',
    description: 'Storygate submission attempted without explicit approved creator_approval_v1 artifact.',
    blocking: true,
    blocksPackageAssembly: false,
    remediation: 'Creator must explicitly approve the Agent Readiness package before Storygate submission.',
    httpStatus: 422,
  },
  {
    kickCode: 'DB_WRITE_FAILURE',
    detectedAt: 'AR04_SECTION_PERSISTENCE',
    description: 'Section persistence write failed; package state cannot be certified from partial/non-durable data.',
    blocking: true,
    blocksPackageAssembly: true,
    remediation: 'Retry persistence and surface system error (500). Do not proceed to export from non-durable section state.',
    httpStatus: 500,
  },
  {
    kickCode: 'AGENT_PACKAGE_RENDERER_OUTPUT_INVALID',
    detectedAt: 'AR08_EXPORT',
    description: 'Package assembly depends on Web/PDF/DOCX/TXT renderer output or evaluation_report_view_model_v1 instead of certified Evaluation / Revise artifacts.',
    blocking: true,
    blocksPackageAssembly: true,
    remediation: 'Invalidate package assembly and rebuild Agent Readiness context from certified UED, evaluation_result_v2, revision_opportunity_ledger_v1, and revision_completion_record_v1 only.',
    httpStatus: 422,
  },
  {
    kickCode: 'INVALID_FORMAT',
    detectedAt: 'AR08_EXPORT',
    description: 'Requested export format is not txt or docx.',
    blocking: true,
    blocksPackageAssembly: false,
    remediation: 'Set format to exactly "txt" or "docx".',
    httpStatus: 400,
  },
] as const;

// ─── Authority Source Registry ──────────────────────────────────────────────

export interface AgentReadinessAuthoritySourceEntry {
  authorityId: string;
  family: AgentReadinessAuthorityFamily;
  title: string;
  path: string;
  appliesToStageIds: string[];
  appliesToArtifacts: string[];
  executionUse: string;
  notes: string;
}

export const AGENT_READINESS_AUTHORITY_SOURCE_REGISTRY: readonly AgentReadinessAuthoritySourceEntry[] = [
  {
    authorityId: 'AR_WORKFLOW_DOCTRINE',
    family: 'doctrine',
    title: 'Agent Readiness Workflow Doctrine',
    path: 'docs/product/agent-readiness-workflow-doctrine.md',
    appliesToStageIds: ['AR01_MANUSCRIPT_ELIGIBILITY', 'AR02_SECTION_GENERATION', 'AR05_AUTHOR_REVIEW', 'AR06_COMPLETENESS_CHECK', 'AR07_BATCH_GENERATION', 'AR08_EXPORT'],
    appliesToArtifacts: ['manuscript_context_v1', 'agent_readiness_package_v1', 'creator_approval_v1'],
    executionUse: 'Binding doctrine for Agent Readiness Package workflow. Top = manuscript. Middle = sections. Bottom = final package.',
    notes: 'Core rule: author confirms manuscript before generating any section. Export does not imply agent interest or representation.',
  },
  {
    authorityId: 'AI_GOVERNANCE',
    family: 'governance',
    title: 'AI Governance',
    path: 'AI_GOVERNANCE.md',
    appliesToStageIds: ['AR01_MANUSCRIPT_ELIGIBILITY', 'AR02_SECTION_GENERATION', 'AR03_QUALITY_GATE', 'AR04_SECTION_PERSISTENCE', 'AR05_AUTHOR_REVIEW', 'AR06_COMPLETENESS_CHECK', 'AR07_BATCH_GENERATION', 'AR08_EXPORT', 'AR09_HISTORY'],
    appliesToArtifacts: ['agent_readiness_section_v1', 'agent_readiness_package_v1', 'quality_gate_result_v1', 'creator_approval_v1'],
    executionUse: 'Binding governance for all Agent Readiness stages. DB errors must not be masked as client errors. System must not invent author bio facts.',
    notes: 'Illegal state transitions must throw. Author bio must reflect only author-supplied facts.',
  },
  {
    authorityId: 'GENERATE_API',
    family: 'contract',
    title: 'Section Generation API',
    path: 'app/api/agent-readiness/generate/route.ts',
    appliesToStageIds: ['AR02_SECTION_GENERATION', 'AR03_QUALITY_GATE', 'AR04_SECTION_PERSISTENCE'],
    appliesToArtifacts: ['section_generation_request_v1', 'section_generation_result_v1', 'quality_gate_result_v1', 'agent_readiness_section_v1'],
    executionUse: 'Defines SectionType, GenerateMode, word limits, word minimums, quality gate patterns, and OpenAI model configuration.',
    notes: 'Model default: gpt-4o. maxDuration: 60s. TIMEOUT_MS: 45_000.',
  },
  {
    authorityId: 'GENERATE_ALL_API',
    family: 'contract',
    title: 'Generate All Sections API',
    path: 'app/api/agent-readiness/generate-all/route.ts',
    appliesToStageIds: ['AR02_SECTION_GENERATION', 'AR07_BATCH_GENERATION'],
    appliesToArtifacts: ['section_generation_request_v1', 'agent_readiness_package_v1'],
    executionUse: 'Defines section generation order: query_pitch → what_makes_unique → synopsis → comparables → query_letter. author_bio generated only if authorBioInput provided and ≥50 chars.',
    notes: 'Sequential generation. Errors per section are non-fatal to other sections.',
  },
  {
    authorityId: 'DOWNLOAD_API',
    family: 'contract',
    title: 'Package Download API',
    path: 'app/api/agent-readiness/download/route.ts',
    appliesToStageIds: ['AR08_EXPORT'],
    appliesToArtifacts: ['agent_readiness_package_v1', 'creator_approval_v1', 'package_export_v1'],
    executionUse: 'Defines export formats (txt/docx), section order in output (query_pitch → query_letter → what_makes_unique → synopsis → comparables → author_bio), and document formatting rules.',
    notes: 'docx uses Word 2003 XML format for maximum client compatibility.',
  },
  {
    authorityId: 'AUTHOR_BIO_GOLD_STANDARDS',
    family: 'gold_standard',
    title: 'Author Bio Gold Standards',
    path: 'lib/agent-readiness/gold-standards/bio/agent_readiness_bio_gold_standards_v1.json',
    appliesToStageIds: ['AR02_SECTION_GENERATION'],
    appliesToArtifacts: ['gold_standard_v1', 'agent_readiness_section_v1'],
    executionUse: 'Defines gold standard author bio examples and quality markers for GPT-4o prompt context.',
    notes: 'Must not be modified without governance review.',
  },
  {
    authorityId: 'AUTHOR_BIO_RUBRIC',
    family: 'rubric',
    title: 'Author Bio Rubric',
    path: 'lib/agent-readiness/gold-standards/bio/author_bio_rubric_v1.md',
    appliesToStageIds: ['AR02_SECTION_GENERATION', 'AR03_QUALITY_GATE'],
    appliesToArtifacts: ['gold_standard_v1', 'quality_gate_result_v1'],
    executionUse: 'Scoring rubric for author bio quality evaluation.',
    notes: 'Author bio must not include invented credentials, awards, education, or personal history.',
  },
  {
    authorityId: 'SYNOPSIS_GOLD_STANDARDS',
    family: 'gold_standard',
    title: 'Synopsis Contract',
    path: 'lib/agent-readiness/gold-standards/synopsis/synopsis_contract_v1.json',
    appliesToStageIds: ['AR02_SECTION_GENERATION'],
    appliesToArtifacts: ['gold_standard_v1', 'agent_readiness_section_v1'],
    executionUse: 'Defines synopsis contract and gold standard examples for GPT-4o prompt context.',
    notes: 'Must not be modified without governance review.',
  },
  {
    authorityId: 'SIPOC_AGENT_READINESS',
    family: 'doctrine',
    title: 'Agent Readiness SIPOC/FIPOC Process Constitution',
    path: 'docs/SIPOC_AGENT_READINESS_PROCESS.md',
    appliesToStageIds: ['AR01_MANUSCRIPT_ELIGIBILITY', 'AR02_SECTION_GENERATION', 'AR03_QUALITY_GATE', 'AR04_SECTION_PERSISTENCE', 'AR05_AUTHOR_REVIEW', 'AR06_COMPLETENESS_CHECK', 'AR07_BATCH_GENERATION', 'AR08_EXPORT', 'AR09_HISTORY'],
    appliesToArtifacts: ['manuscript_context_v1', 'section_generation_request_v1', 'section_generation_result_v1', 'quality_gate_result_v1', 'agent_readiness_section_v1', 'author_review_decision_v1', 'package_completeness_result_v1', 'agent_readiness_package_v1', 'creator_approval_v1', 'package_export_v1'],
    executionUse: 'Canonical SIPOC constitution for all Agent Readiness stages. Defines runtime doctrine, known gaps, canonical enum values, and stage responsibility boundaries.',
    notes: 'This document is the machine-authoritative counterpart to the registry. All known gaps are documented here. Changes to the registry must be reflected here.',
  },
] as const;

// ─── Renderer / Consumer Matrix ─────────────────────────────────────────────

export interface AgentReadinessRendererEntry {
  surface: string;
  route: string;
  consumedArtifacts: string[];
  consumedFields: string[];
  writeCapability: boolean;
  notes: string;
}

export const AGENT_READINESS_RENDERER_MATRIX: readonly AgentReadinessRendererEntry[] = [
  {
    surface: 'AgentReadinessMainPage',
    route: '/agent-readiness',
    consumedArtifacts: ['manuscript_context_v1', 'package_completeness_result_v1'],
    consumedFields: ['manuscriptId', 'evaluationJobId', 'manuscriptTitle', 'packageStatus', 'allSectionsApproved'],
    writeCapability: false,
    notes: 'Manuscript selector + package status. Entry point to section workflow. URL params override dashboard default. Must not consume EvaluationReportViewModel or renderer/download output.',
  },
  {
    surface: 'QueryLetterPage',
    route: '/agent-readiness/query-letter',
    consumedArtifacts: ['agent_readiness_section_v1', 'manuscript_context_v1'],
    consumedFields: ['content', 'status', 'manuscriptId', 'evaluationJobId'],
    writeCapability: true,
    notes: 'Generate, edit, approve query_letter section. Carries manuscriptId in URL context. Section context comes from certified Agent Readiness artifacts, not renderer/download output.',
  },
  {
    surface: 'SynopsisPage',
    route: '/agent-readiness/synopsis',
    consumedArtifacts: ['agent_readiness_section_v1', 'manuscript_context_v1'],
    consumedFields: ['content', 'status', 'manuscriptId', 'evaluationJobId'],
    writeCapability: true,
    notes: 'Generate, edit, approve synopsis section.',
  },
  {
    surface: 'PitchPage',
    route: '/agent-readiness/pitch',
    consumedArtifacts: ['agent_readiness_section_v1', 'manuscript_context_v1'],
    consumedFields: ['content', 'status', 'manuscriptId', 'evaluationJobId'],
    writeCapability: true,
    notes: 'Generate, edit, approve query_pitch section.',
  },
  {
    surface: 'BioPage',
    route: '/agent-readiness/bio',
    consumedArtifacts: ['agent_readiness_section_v1', 'manuscript_context_v1'],
    consumedFields: ['content', 'status', 'manuscriptId', 'evaluationJobId', 'authorBioInput'],
    writeCapability: true,
    notes: 'Generate, edit, approve author_bio section. authorBioInput required. Must not invent credentials.',
  },
  {
    surface: 'ComparablesPage',
    route: '/agent-readiness/comparables',
    consumedArtifacts: ['agent_readiness_section_v1', 'manuscript_context_v1'],
    consumedFields: ['content', 'status', 'manuscriptId', 'evaluationJobId'],
    writeCapability: true,
    notes: 'Generate, edit, approve comparables section.',
  },
  {
    surface: 'HistoryPage',
    route: '/agent-readiness/history',
    consumedArtifacts: ['package_history_record_v1'],
    consumedFields: ['manuscript_id', 'user_id', 'created_at', 'packageStatus'],
    writeCapability: false,
    notes: 'Read-only package version history. Future: bind to persistent package records.',
  },
  {
    surface: 'Dashboard',
    route: '/dashboard',
    consumedArtifacts: ['evaluation_job_record_v1'],
    consumedFields: ['manuscriptId', 'evaluationJobId', 'status'],
    writeCapability: false,
    notes: 'Entry point to Agent Readiness. Links visible only for completed evaluations. URL shape: /agent-readiness?manuscriptId=<id>&evaluationJobId=<id>.',
  },
] as const;

// ─── Certification Gate Registry ────────────────────────────────────────────

export interface AgentReadinessCertificationGateEntry {
  gateId: string;
  description: string;
  appliesToStageId: string;
  enforced: boolean;
  testEvidence: string;
  notes: string;
}

export const AGENT_READINESS_CERTIFICATION_GATE_REGISTRY: readonly AgentReadinessCertificationGateEntry[] = [
  {
    gateId: 'ARCG01_MANUSCRIPT_ELIGIBILITY',
    description: 'Only evaluations with status not in {running, failed, queued, canceled, incomplete} may enter the workflow.',
    appliesToStageId: 'AR01_MANUSCRIPT_ELIGIBILITY',
    enforced: true,
    testEvidence: '__tests__/lib/agent-readiness/agentReadinessRegistry.test.ts',
    notes: 'Enforced in app/agent-readiness/page.tsx via completedRows filter.',
  },
  {
    gateId: 'ARCG02_AUTH_GATE',
    description: 'All section generation and persistence operations require authenticated user session.',
    appliesToStageId: 'AR02_SECTION_GENERATION',
    enforced: true,
    testEvidence: '__tests__/lib/agent-readiness/agentReadinessRegistry.test.ts',
    notes: 'getAuthenticatedUser() called in generate/route.ts.',
  },
  {
    gateId: 'ARCG03_QUALITY_GATE',
    description: 'Generated section must pass all quality gate checks before persistence: no meta-language, no placeholders, within word limit, above word minimum.',
    appliesToStageId: 'AR03_QUALITY_GATE',
    enforced: true,
    testEvidence: '__tests__/lib/agent-readiness/agentReadinessRegistry.test.ts',
    notes: '5 separate kick codes enforced by qualityGate() in generate/route.ts.',
  },
  {
    gateId: 'ARCG04_NO_DRAFT_PERSISTENCE_AS_APPROVED',
    description: 'Section status must be draft at persistence time. Only explicit author action transitions to approved.',
    appliesToStageId: 'AR04_SECTION_PERSISTENCE',
    enforced: true,
    testEvidence: '__tests__/lib/agent-readiness/agentReadinessRegistry.test.ts',
    notes: 'Enforced by registry field definition: status canonicalValues = [draft, approved]; initial write always draft.',
  },
  {
    gateId: 'ARCG05_ALL_SECTIONS_APPROVED_BEFORE_ASSEMBLY',
    description: 'Package assembly CTA is disabled if fewer than 6 sections are approved. allSectionsApproved must be true.',
    appliesToStageId: 'AR06_COMPLETENESS_CHECK',
    enforced: true,
    testEvidence: '__tests__/lib/agent-readiness/agentReadinessRegistry.test.ts',
    notes: 'Enforced in app/agent-readiness/page.tsx via getPackageStatuses() + allApproved check.',
  },
  {
    gateId: 'ARCG06_AUTHOR_BIO_NO_INVENTED_FACTS',
    description: 'Author bio generation must shape only author-supplied facts. Must not invent credentials, awards, education, platform, publications, or personal history.',
    appliesToStageId: 'AR05_AUTHOR_REVIEW',
    enforced: false,
    testEvidence: 'lib/agent-readiness/gold-standards/bio/author_bio_rubric_v1.md',
    notes: 'Enforced by prompt instructions and rubric. No automated test gate — rubric review required.',
  },
  {
    gateId: 'ARCG07_EXPORT_FORMAT_VALID',
    description: 'Export format must be exactly txt or docx. No other values accepted.',
    appliesToStageId: 'AR08_EXPORT',
    enforced: true,
    testEvidence: '__tests__/lib/agent-readiness/agentReadinessRegistry.test.ts',
    notes: 'Enforced by ExportFormat type in registry and format field canonicalValues.',
  },
  {
    gateId: 'ARCG08_DB_ERRORS_NOT_MASKED',
    description: 'Database and system errors must not be masked as client (400) errors.',
    appliesToStageId: 'AR04_SECTION_PERSISTENCE',
    enforced: true,
    testEvidence: '__tests__/lib/agent-readiness/agentReadinessRegistry.test.ts',
    notes: 'Per AI_GOVERNANCE.md. DB write failure must surface as 500.',
  },
  {
    gateId: 'ARCG09_CREATOR_APPROVAL_GATE',
    description: 'Storygate submission requires explicit creator approval of the Agent Readiness package.',
    appliesToStageId: 'AR08_EXPORT',
    enforced: true,
    testEvidence: '__tests__/lib/agent-readiness/creatorApprovalGate.test.ts; __tests__/lib/storygate/storygateSubmissionValidator.test.ts',
    notes: 'Pure validator gate until persistence workflow exists. Missing, pending, or rejected approval blocks Storygate submission with failure_diagnosis_v1.',
  },
] as const;

// ─── Section Word Limit Contract ────────────────────────────────────────────

export interface AgentReadinessSectionLimitEntry {
  section: SectionType;
  wordLimit: number;
  wordMinimum: number | null;
  hasMinimum: boolean;
}

export const SECTION_WORD_LIMIT_REGISTRY: readonly AgentReadinessSectionLimitEntry[] = [
  { section: 'query_letter',      wordLimit: 450, wordMinimum: 200, hasMinimum: true },
  { section: 'what_makes_unique', wordLimit: 150, wordMinimum: 60,  hasMinimum: true },
  { section: 'synopsis',          wordLimit: 500, wordMinimum: 150, hasMinimum: true },
  { section: 'query_pitch',       wordLimit: 75,  wordMinimum: null, hasMinimum: false },
  { section: 'comparables',       wordLimit: 200, wordMinimum: null, hasMinimum: false },
  { section: 'author_bio',        wordLimit: 200, wordMinimum: 50,  hasMinimum: true },
] as const;
