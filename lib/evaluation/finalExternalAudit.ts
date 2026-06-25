export type FinalExternalAuditStatus = 'pass' | 'warn' | 'block'

export type FinalExternalAuditFamily =
  | 'authority'
  | 'template'
  | 'evidence'
  | 'story_ledger'
  | 'recommendation'
  | 'renderer'
  | 'wave'
  | 'phase5'

export type FinalExternalAuditCheck = {
  check_id: string
  family: FinalExternalAuditFamily
  status: FinalExternalAuditStatus
  reason_code: string
  message: string
  affected_artifacts: string[]
  author_facing_risk: 'low' | 'medium' | 'high'
  required_fix: string | null
}

export type FinalExternalAuditArtifact = {
  artifact_type: 'final_external_audit_v1'
  schema_version: 1
  job_id: string
  manuscript_id: string | number | null
  manuscript_version_id: string | null
  input_artifacts: string[]
  authority_basis: {
    registry_path: string
    runtime_benchmark_authority_map_path: string
    template_path: string
    checksums: Record<string, string>
  }
  status: FinalExternalAuditStatus
  blocking_reason_codes: string[]
  warning_reason_codes: string[]
  checks: FinalExternalAuditCheck[]
  summary: string
  created_at: string
  is_resume_safe: boolean
}

export type FinalExternalAuditInput = {
  jobId: string
  manuscriptId?: string | number | null
  manuscriptVersionId?: string | null
  now?: string
  inputArtifacts?: string[]
  authorityChecksums?: Record<string, string>
  phase0AuthorityProofStatus?: 'valid' | 'degraded' | 'blocked' | null
  runtimeBenchmarkMapLoaded?: boolean
  outputMode?: string | null
  evaluationMode?: string | null
  dreamDocumentPresent?: boolean
  longFormTemplateComplete?: boolean
  criteriaCount?: number | null
  evidenceAnchorsPresent?: boolean
  acceptedStoryLedgerPresent?: boolean
  recommendationLedgerPresent?: boolean
  recommendationsSpecific?: boolean
  uedPresent?: boolean
  viewModelPresent?: boolean
  rendererParityStatus?: 'pass' | 'warn' | 'fail' | 'missing' | null
  waveStatus?: 'pass' | 'warn' | 'block' | 'missing' | null
  authorExposureCertificationStatus?: 'certified' | 'blocked' | 'missing' | null
}

const AUTHORITY_REGISTRY_PATH = 'docs/phase-0-warmup/PHASE_0_AUTHORITY_REGISTRY.md'
const RUNTIME_BENCHMARK_MAP_PATH = 'docs/benchmarks/RUNTIME_BENCHMARK_AUTHORITY_MAP.md'
const LONG_FORM_TEMPLATE_PATH = 'docs/templates/evaluation/long-form-multi-layer-evaluation-template.md'

function check(
  condition: boolean,
  pass: Omit<FinalExternalAuditCheck, 'status'>,
  fail: Omit<FinalExternalAuditCheck, 'status'> & { status?: FinalExternalAuditStatus },
): FinalExternalAuditCheck {
  return condition ? { ...pass, status: 'pass' } : { ...fail, status: fail.status ?? 'block' }
}

function statusFromChecks(checks: FinalExternalAuditCheck[]): FinalExternalAuditStatus {
  if (checks.some((item) => item.status === 'block')) return 'block'
  if (checks.some((item) => item.status === 'warn')) return 'warn'
  return 'pass'
}

export function buildFinalExternalAuditArtifact(input: FinalExternalAuditInput): FinalExternalAuditArtifact {
  const checks: FinalExternalAuditCheck[] = []
  const isLongFormMultiLayer =
    input.outputMode === 'multi_layer_long_form' ||
    input.evaluationMode === 'long_form_multi_layer_evaluation'

  checks.push(check(
    input.phase0AuthorityProofStatus === 'valid' || input.phase0AuthorityProofStatus === 'degraded',
    {
      check_id: 'authority.phase0_proof_present',
      family: 'authority',
      reason_code: 'PHASE0_AUTHORITY_PROOF_ACCEPTED',
      message: 'Phase 0 authority proof is present and acceptable.',
      affected_artifacts: ['phase0_authority_proof_v1'],
      author_facing_risk: 'low',
      required_fix: null,
    },
    {
      check_id: 'authority.phase0_proof_present',
      family: 'authority',
      reason_code: 'PHASE0_AUTHORITY_PROOF_MISSING_OR_BLOCKED',
      message: 'Phase 0 authority proof is missing or blocked before final audit.',
      affected_artifacts: ['phase0_authority_proof_v1'],
      author_facing_risk: 'high',
      required_fix: 'Load Phase 0 authority and persist phase0_authority_proof_v1 before release.',
    },
  ))

  checks.push(check(
    input.runtimeBenchmarkMapLoaded === true,
    {
      check_id: 'authority.runtime_benchmark_map_loaded',
      family: 'authority',
      reason_code: 'RUNTIME_BENCHMARK_MAP_LOADED',
      message: 'Runtime benchmark authority map was loaded or recorded.',
      affected_artifacts: [RUNTIME_BENCHMARK_MAP_PATH],
      author_facing_risk: 'low',
      required_fix: null,
    },
    {
      check_id: 'authority.runtime_benchmark_map_loaded',
      family: 'authority',
      reason_code: 'RUNTIME_BENCHMARK_MAP_MISSING',
      message: 'Runtime benchmark authority map was not loaded or recorded.',
      affected_artifacts: [RUNTIME_BENCHMARK_MAP_PATH],
      author_facing_risk: 'medium',
      required_fix: 'Record the runtime benchmark authority map in Phase 0/0.5 or audit metadata.',
      status: 'warn',
    },
  ))

  checks.push(check(
    isLongFormMultiLayer,
    {
      check_id: 'template.output_mode_multi_layer',
      family: 'template',
      reason_code: 'LONG_FORM_MULTI_LAYER_MODE_CONFIRMED',
      message: 'Evaluation uses the canonical long-form multi-layer mode.',
      affected_artifacts: ['evaluation_result_v2', 'longform_document_v1'],
      author_facing_risk: 'low',
      required_fix: null,
    },
    {
      check_id: 'template.output_mode_multi_layer',
      family: 'template',
      reason_code: 'LEGACY_LONG_FORM_MODE_OR_UNKNOWN',
      message: 'Evaluation does not identify as long_form_multi_layer_evaluation / multi_layer_long_form.',
      affected_artifacts: ['evaluation_result_v2', 'longform_document_v1'],
      author_facing_risk: 'high',
      required_fix: 'Route long-form output through the multi-layer template and output mode.',
    },
  ))

  checks.push(check(
    input.dreamDocumentPresent === true && input.longFormTemplateComplete === true,
    {
      check_id: 'template.dream_document_complete',
      family: 'template',
      reason_code: 'DREAM_DOCUMENT_COMPLETE',
      message: 'DREAM long-form multi-layer document is present and template-complete.',
      affected_artifacts: ['longform_document_v1'],
      author_facing_risk: 'low',
      required_fix: null,
    },
    {
      check_id: 'template.dream_document_complete',
      family: 'template',
      reason_code: 'DREAM_DOCUMENT_MISSING_OR_INCOMPLETE',
      message: 'DREAM long-form multi-layer document is missing or template-incomplete.',
      affected_artifacts: ['longform_document_v1'],
      author_facing_risk: 'high',
      required_fix: 'Produce all required long-form multi-layer template surfaces before release.',
    },
  ))

  checks.push(check(
    typeof input.criteriaCount === 'number' && input.criteriaCount >= 13,
    {
      check_id: 'template.criteria_count',
      family: 'template',
      reason_code: 'CANONICAL_13_CRITERIA_PRESENT',
      message: 'All canonical 13 criteria are present or accounted for.',
      affected_artifacts: ['evaluation_result_v2', 'unified_evaluation_document_v1'],
      author_facing_risk: 'low',
      required_fix: null,
    },
    {
      check_id: 'template.criteria_count',
      family: 'template',
      reason_code: 'CANONICAL_CRITERIA_INCOMPLETE',
      message: 'Fewer than 13 criteria are present without an explicit insufficiency/N-A pathway.',
      affected_artifacts: ['evaluation_result_v2', 'unified_evaluation_document_v1'],
      author_facing_risk: 'high',
      required_fix: 'Restore all canonical criteria or explicit N/A/insufficiency handling before release.',
    },
  ))

  checks.push(check(
    input.evidenceAnchorsPresent === true,
    {
      check_id: 'evidence.anchors_present',
      family: 'evidence',
      reason_code: 'EVIDENCE_ANCHORS_PRESENT',
      message: 'Findings and recommendations have usable evidence anchors.',
      affected_artifacts: ['evaluation_result_v2', 'revision_opportunity_ledger_v1'],
      author_facing_risk: 'low',
      required_fix: null,
    },
    {
      check_id: 'evidence.anchors_present',
      family: 'evidence',
      reason_code: 'EVIDENCE_ANCHORS_MISSING',
      message: 'Evidence anchors are missing or placeholder-like.',
      affected_artifacts: ['evaluation_result_v2', 'revision_opportunity_ledger_v1'],
      author_facing_risk: 'high',
      required_fix: 'Ground major findings and revise opportunities in manuscript evidence.',
    },
  ))

  checks.push(check(
    input.acceptedStoryLedgerPresent === true,
    {
      check_id: 'story_ledger.accepted_or_verified',
      family: 'story_ledger',
      reason_code: 'STORY_LEDGER_AUTHORITY_PRESENT',
      message: 'Accepted or verified Story Ledger authority is available.',
      affected_artifacts: ['accepted_story_ledger_v1', 'story_map_seed_v1'],
      author_facing_risk: 'low',
      required_fix: null,
    },
    {
      check_id: 'story_ledger.accepted_or_verified',
      family: 'story_ledger',
      reason_code: 'STORY_LEDGER_AUTHORITY_MISSING',
      message: 'Accepted or verified Story Ledger authority is missing.',
      affected_artifacts: ['accepted_story_ledger_v1', 'story_map_seed_v1'],
      author_facing_risk: 'medium',
      required_fix: 'Verify seed/story ledger authority before final synthesis or mark evaluation degraded.',
      status: 'warn',
    },
  ))

  checks.push(check(
    input.recommendationLedgerPresent === true && input.recommendationsSpecific === true,
    {
      check_id: 'recommendation.ledger_specific',
      family: 'recommendation',
      reason_code: 'RECOMMENDATION_LEDGER_SPECIFIC',
      message: 'Canonical recommendation ledger exists and appears specific enough for Revise.',
      affected_artifacts: ['revision_opportunity_ledger_v1'],
      author_facing_risk: 'low',
      required_fix: null,
    },
    {
      check_id: 'recommendation.ledger_specific',
      family: 'recommendation',
      reason_code: 'RECOMMENDATION_LEDGER_MISSING_OR_GENERIC',
      message: 'Recommendation ledger is missing, generic, unsupported, or not Revise-ready.',
      affected_artifacts: ['revision_opportunity_ledger_v1'],
      author_facing_risk: 'high',
      required_fix: 'Regenerate or repair the canonical recommendation ledger with six-part specificity.',
    },
  ))

  checks.push(check(
    input.uedPresent === true && input.viewModelPresent === true,
    {
      check_id: 'renderer.ued_viewmodel_present',
      family: 'renderer',
      reason_code: 'UED_VIEWMODEL_PRESENT',
      message: 'UED and ViewModel are available for renderer consumption.',
      affected_artifacts: ['unified_evaluation_document_v1', 'evaluation_report_view_model_v1'],
      author_facing_risk: 'low',
      required_fix: null,
    },
    {
      check_id: 'renderer.ued_viewmodel_present',
      family: 'renderer',
      reason_code: 'UED_OR_VIEWMODEL_MISSING',
      message: 'UED or ViewModel is missing before author exposure.',
      affected_artifacts: ['unified_evaluation_document_v1', 'evaluation_report_view_model_v1'],
      author_facing_risk: 'high',
      required_fix: 'Build UED and ViewModel before rendering author-facing surfaces.',
    },
  ))

  checks.push(check(
    input.rendererParityStatus === 'pass' || input.rendererParityStatus === 'warn',
    {
      check_id: 'renderer.parity_status',
      family: 'renderer',
      reason_code: 'RENDERER_PARITY_ACCEPTABLE',
      message: 'Renderer parity is pass or explicitly warned.',
      affected_artifacts: ['report_render_manifest_v1'],
      author_facing_risk: input.rendererParityStatus === 'warn' ? 'medium' : 'low',
      required_fix: null,
    },
    {
      check_id: 'renderer.parity_status',
      family: 'renderer',
      reason_code: 'RENDERER_PARITY_FAILED_OR_MISSING',
      message: 'Renderer parity is failed, blocked, or missing.',
      affected_artifacts: ['report_render_manifest_v1'],
      author_facing_risk: 'high',
      required_fix: 'Fix Web/PDF/DOCX/TXT parity before author exposure.',
    },
  ))

  checks.push(check(
    input.waveStatus !== 'block',
    {
      check_id: 'wave.status_not_blocked',
      family: 'wave',
      reason_code: 'WAVE_NOT_BLOCKING',
      message: 'WAVE is not blocking final exposure.',
      affected_artifacts: ['wave_revision_plan_v1'],
      author_facing_risk: input.waveStatus === 'warn' || input.waveStatus === 'missing' ? 'medium' : 'low',
      required_fix: null,
    },
    {
      check_id: 'wave.status_not_blocked',
      family: 'wave',
      reason_code: 'WAVE_BLOCKING',
      message: 'WAVE produced a blocking result.',
      affected_artifacts: ['wave_revision_plan_v1'],
      author_facing_risk: 'high',
      required_fix: 'Resolve WAVE blocking issues before final exposure.',
    },
  ))

  checks.push(check(
    input.authorExposureCertificationStatus !== 'blocked',
    {
      check_id: 'phase5.not_preblocked',
      family: 'phase5',
      reason_code: 'PHASE5_NOT_PREBLOCKED',
      message: 'Phase 5 is not already marked blocked.',
      affected_artifacts: ['author_exposure_certification_v1'],
      author_facing_risk: input.authorExposureCertificationStatus === 'missing' ? 'medium' : 'low',
      required_fix: null,
    },
    {
      check_id: 'phase5.not_preblocked',
      family: 'phase5',
      reason_code: 'PHASE5_PREBLOCKED',
      message: 'Author exposure certification is already blocked.',
      affected_artifacts: ['author_exposure_certification_v1'],
      author_facing_risk: 'high',
      required_fix: 'Resolve Phase 5 blocking reasons before release.',
    },
  ))

  const status = statusFromChecks(checks)
  const blockingReasonCodes = checks.filter((item) => item.status === 'block').map((item) => item.reason_code)
  const warningReasonCodes = checks.filter((item) => item.status === 'warn').map((item) => item.reason_code)

  return {
    artifact_type: 'final_external_audit_v1',
    schema_version: 1,
    job_id: input.jobId,
    manuscript_id: input.manuscriptId ?? null,
    manuscript_version_id: input.manuscriptVersionId ?? null,
    input_artifacts: input.inputArtifacts ?? [],
    authority_basis: {
      registry_path: AUTHORITY_REGISTRY_PATH,
      runtime_benchmark_authority_map_path: RUNTIME_BENCHMARK_MAP_PATH,
      template_path: LONG_FORM_TEMPLATE_PATH,
      checksums: input.authorityChecksums ?? {},
    },
    status,
    blocking_reason_codes: blockingReasonCodes,
    warning_reason_codes: warningReasonCodes,
    checks,
    summary:
      status === 'pass'
        ? 'Final external audit passed. Evaluation may proceed to Phase 5 certification.'
        : status === 'warn'
          ? 'Final external audit passed with warnings. Phase 5 may proceed only with explicit tolerance.'
          : 'Final external audit blocked. Do not expose, download, revise, or package this evaluation for agents.',
    created_at: input.now ?? new Date().toISOString(),
    is_resume_safe: status !== 'block',
  }
}

export function finalExternalAuditAllowsAuthorExposure(audit: unknown): boolean {
  if (!audit || typeof audit !== 'object' || Array.isArray(audit)) return false
  const record = audit as Record<string, unknown>
  if (record.artifact_type !== 'final_external_audit_v1') return false
  const status = typeof record.status === 'string' ? record.status.trim().toLowerCase() : ''
  return status === 'pass' || status === 'warn'
}
