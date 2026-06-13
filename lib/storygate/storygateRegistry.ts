/**
 * Storygate Studio — Executable SIPOC/FIPOC Registry
 *
 * Machine-checkable source of truth for current RevisionGrade-native Storygate
 * Studio governance. Storygate is literary/publishing-facing only at this time.
 * Base44 Storygate materials are legacy reference only and are not binding
 * authority for current Storygate Studio canon.
 *
 * Governance: docs/storygate/STORYGATE_STUDIO_CANON.md
 * SIPOC:      docs/SIPOC_STORYGATE_PROCESS.md
 */

export type StorygateActiveState = 'active' | 'planned_required' | 'deferred';
export type StorygateCertificationStatus = 'proven' | 'partial' | 'emerging' | 'missing_critical';
export type StorygateFitGapStatus = 'ok' | 'gap' | 'critical';
export type StorygateSubmissionStatus = 'SUBMITTED' | 'REVIEWING' | 'DECLINED' | 'HOLD' | 'APPROVED';
export type StorygateScreeningStatus = 'ELIGIBLE' | 'AUTO_DECLINED' | 'RECOMMEND_HUMAN_REVIEW';
export type StorygateVerificationState = 'verified' | 'unverified';
export type StorygateListingVisibility = 'private' | 'restricted' | 'active';
export type StorygateAccessDecision = 'requested' | 'approved' | 'denied' | 'revoked';
export type StorygateAuthorityFamily = 'governance' | 'doctrine' | 'contract' | 'runtime' | 'policy' | 'legacy';
export type StorygateAuthorityLevel = 'binding' | 'secondary' | 'runtime_reference' | 'legacy_reference_only';

export const STORYGATE_ADMISSION_THRESHOLD = 9.0 as const;
export const STORYGATE_READINESS_THRESHOLD = STORYGATE_ADMISSION_THRESHOLD;
export const STORYGATE_SCREENING_IMPLEMENTATION_THRESHOLD = STORYGATE_ADMISSION_THRESHOLD;

export const STORYGATE_REQUIRED_PACKAGE_FIELDS = [
  'query_letter',
  'synopsis',
  'author_bio',
  'elevator_pitch',
  'agent_pitch',
  'market_comparables',
  'market_category',
  'target_audience',
  'market_position_statement',
  'sample_pages',
  'rights_declaration',
] as const;

export const STORYGATE_FORBIDDEN_SCOPE_TERMS = [
  'film_track',
  'film_deck',
  'screenplay_conversion',
  'manuscript_to_screenplay_adaptation',
  'treatment',
  'producer_facing_materials',
  'film_rights_marketplace',
] as const;

const REQUIRED_PACKAGE_FIELDS = [...STORYGATE_REQUIRED_PACKAGE_FIELDS];

export interface StorygateProcessEntry {
  sequence: number;
  stageId: string;
  processName: string;
  activeState: StorygateActiveState;
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
  certificationStatus: StorygateCertificationStatus;
  fitGapStatus: StorygateFitGapStatus;
  notes: string;
}

export const STORYGATE_PROCESS_REGISTRY: readonly StorygateProcessEntry[] = [
  {
    sequence: 1,
    stageId: 'SG01_CREATOR_SUBMISSION',
    processName: 'Creator Submission Entry',
    activeState: 'active',
    supplier: 'Creator / author via Storygate Studio preparation surfaces',
    inputArtifacts: ['agent_readiness_package_v1', 'storygate_submission_request_v1'],
    inputRequiredFields: ['project_title', 'primary_genre', 'creator_name', 'creator_email', ...REQUIRED_PACKAGE_FIELDS],
    inputMetrics: ['submission_attempt_count', 'package_completeness_rate'],
    codeSurfaces: ['app/storygate-studio/page.tsx', 'app/storygate-studio/apply/page.tsx', 'app/storygate-studio/faq/page.tsx'],
    processContract: 'Creator prepares a manuscript-first, publishing-facing Storygate package. The required package is query letter, synopsis, author bio, elevator pitch, agent pitch, market comparables, market category, target audience, market position statement, sample pages, and rights declaration. Current Next.js routes are preparation/eligibility surfaces, not a certified submission persistence path.',
    outputArtifacts: ['storygate_submission_request_v1'],
    outputRequiredFields: ['project_title', 'creator_email', ...REQUIRED_PACKAGE_FIELDS],
    outputMetrics: ['complete_submission_payload_count'],
    forwardKick: 'SG02_INTAKE_VALIDATION',
    backwardKick: 'none — creator remains on preparation surface until package is complete',
    dirtyDataRules: [
      'Submission must be creator-controlled; no public listing is created from SG01.',
      'Market comparables are required for current Storygate Studio package readiness.',
      'Market category is required to identify where the manuscript lives operationally in the publishing market.',
      'Target audience and market position statement are required to show where the manuscript sits on the shelf.',
      'Film, screen, adaptation, producer-facing, and film-rights marketplace materials are out of current scope.',
    ],
    failureCodes: ['UNAUTHENTICATED', 'MISSING_REQUIRED_FIELDS', 'FORBIDDEN_SCOPE_REQUESTED'],
    consumers: ['SG02_INTAKE_VALIDATION'],
    uiExposed: true,
    certificationStatus: 'partial',
    fitGapStatus: 'gap',
    notes: 'Current public app surfaces describe package preparation; durable submission implementation is not certified in this repo snapshot.',
  },
  {
    sequence: 2,
    stageId: 'SG02_INTAKE_VALIDATION',
    processName: 'Submission Intake Validation',
    activeState: 'active',
    supplier: 'SG01_CREATOR_SUBMISSION payload',
    inputArtifacts: ['storygate_submission_request_v1'],
    inputRequiredFields: ['project_title', 'creator_email', ...REQUIRED_PACKAGE_FIELDS],
    inputMetrics: ['validation_failure_rate', 'package_missing_field_count'],
    codeSurfaces: ['lib/storygate/storygateSubmissionValidator.ts', 'docs/storygate/STORYGATE_STUDIO_CANON.md', 'app/storygate-studio/apply/page.tsx'],
    processContract: 'Validate the current Storygate package contract before a submission snapshot can be created. Validation must reject missing required package fields, placeholder content, unsupported non-book scope, and unverifiable rights claims.',
    outputArtifacts: ['intake_validation_result_v1'],
    outputRequiredFields: ['valid', 'failureCodes'],
    outputMetrics: ['valid_payload_rate', 'field_failure_distribution'],
    forwardKick: 'SG03_INTERNAL_SCREENING (on pass)',
    backwardKick: 'SG01_CREATOR_SUBMISSION (on validation failure)',
    dirtyDataRules: ['System/database errors must return 500 and must not be masked as 400-class validation failures.'],
    failureCodes: ['MISSING_REQUIRED_FIELDS', 'PLACEHOLDER_TEXT_DETECTED', 'MARKET_COMPARABLES_MISSING', 'RIGHTS_DECLARATION_MISSING', 'FORBIDDEN_SCOPE_REQUESTED'],
    consumers: ['SG03_INTERNAL_SCREENING'],
    uiExposed: false,
    certificationStatus: 'partial',
    fitGapStatus: 'gap',
    notes: 'Current-canon validator exists and enforces required fields, placeholders, forbidden scope, rights declaration, and 9.0/equivalent readiness. Remaining gap: route/database persistence for durable Storygate submissions.',
  },
  {
    sequence: 3,
    stageId: 'SG03_INTERNAL_SCREENING',
    processName: 'Internal Screening',
    activeState: 'planned_required',
    supplier: 'Internal reviewer / governance validator',
    inputArtifacts: ['storygate_submission_request_v1', 'intake_validation_result_v1'],
    inputRequiredFields: ['submission_id', 'readiness_score_or_equivalent', ...REQUIRED_PACKAGE_FIELDS],
    inputMetrics: ['screening_latency_ms', 'auto_decline_rate'],
    codeSurfaces: ['docs/storygate/STORYGATE_STUDIO_CANON.md'],
    processContract: 'Screen submission for Storygate admission threshold, current literary/publishing scope, required package completeness, rights declaration, and creator-safe screening reasons. Storygate Studio admission threshold is 9.0/10; RevisionGrade readiness and Storygate admission are separate gates.',
    outputArtifacts: ['screening_result_v1'],
    outputRequiredFields: ['screeningStatus', 'screeningReasons'],
    outputMetrics: ['eligible_count', 'auto_declined_count', 'human_review_recommended_count'],
    forwardKick: 'SG04_TIER_ASSIGNMENT',
    backwardKick: 'SG01_CREATOR_SUBMISSION (if missing materials require creator remediation)',
    dirtyDataRules: ['Do not institutionalize 8.0 as Storygate admission. Do not infer film/adaptation eligibility.'],
    failureCodes: ['SCORE_BELOW_THRESHOLD', 'PACKAGE_GATE_FAILED', 'FORBIDDEN_SCOPE_REQUESTED', 'RIGHTS_GATE_FAILED'],
    consumers: ['SG04_TIER_ASSIGNMENT', 'SG06_READINESS_VERIFICATION'],
    uiExposed: false,
    certificationStatus: 'missing_critical',
    fitGapStatus: 'critical',
    notes: 'No current-canon Storygate screening route is certified in this repo snapshot. Registry describes required behavior and blocks false completion claims.',
  },
  {
    sequence: 4,
    stageId: 'SG04_TIER_ASSIGNMENT',
    processName: 'Tier Assignment',
    activeState: 'planned_required',
    supplier: 'Internal reviewer',
    inputArtifacts: ['screening_result_v1', 'storygate_submission_request_v1'],
    inputRequiredFields: ['submission_id', 'screeningStatus', 'screeningReasons'],
    inputMetrics: ['tier_distribution', 'manual_review_rate'],
    codeSurfaces: ['docs/SIPOC_STORYGATE_PROCESS.md'],
    processContract: 'Assign internal tier: Tier 1 auto-decline / not ready, Tier 2 hold/maybe, Tier 3 review/engage. Tier assignment is internal and must not expose project to industry.',
    outputArtifacts: ['tier_assignment_v1'],
    outputRequiredFields: ['tier', 'submission_id', 'reviewer_notes'],
    outputMetrics: ['tier1_count', 'tier2_count', 'tier3_count'],
    forwardKick: 'SG05_PACKAGE_VERIFICATION',
    backwardKick: 'SG03_INTERNAL_SCREENING (if screening reasons incomplete)',
    dirtyDataRules: ['Tier must not be inferred by public UI.', 'Tier assignment must not itself create industry-visible listing.'],
    failureCodes: ['MISSING_TIER_DECISION', 'NON_CANONICAL_TIER'],
    consumers: ['SG05_PACKAGE_VERIFICATION'],
    uiExposed: false,
    certificationStatus: 'missing_critical',
    fitGapStatus: 'critical',
    notes: 'Tier doctrine is mapped but no current persisted tier/audit evidence is certified in this repo snapshot.',
  },
  {
    sequence: 5,
    stageId: 'SG05_PACKAGE_VERIFICATION',
    processName: 'Professional Package Verification',
    activeState: 'active',
    supplier: 'Agent Readiness package or equivalent professional package',
    inputArtifacts: ['agent_readiness_package_v1', 'tier_assignment_v1'],
    inputRequiredFields: REQUIRED_PACKAGE_FIELDS,
    inputMetrics: ['package_gate_pass_rate', 'missing_package_field_count'],
    codeSurfaces: ['app/storygate-studio/page.tsx', 'app/storygate-studio/apply/page.tsx', 'app/storygate-studio/faq/page.tsx'],
    processContract: 'Verify the complete agent-facing package: query letter, synopsis, author bio, elevator pitch, agent pitch, market comparables, market category, target audience, market position statement, sample pages, and rights declaration. Agent Readiness output may satisfy the gate only when supplemented with every required Storygate field; equivalent professional materials may also satisfy the gate. Buying RevisionGrade services is not required.',
    outputArtifacts: ['package_verification_result_v1'],
    outputRequiredFields: ['packageGatePass', ...REQUIRED_PACKAGE_FIELDS],
    outputMetrics: ['package_gate_pass_rate'],
    forwardKick: 'SG06_READINESS_VERIFICATION',
    backwardKick: 'SG01_CREATOR_SUBMISSION or Agent Readiness Factory (if package incomplete)',
    dirtyDataRules: ['Market comparables are not optional for Storygate admission.', 'Market category is not optional for Storygate package verification.', 'Target audience and market position statement are not optional for Storygate package verification.', 'Rights declaration must be explicit before listing activation.'],
    failureCodes: ['PACKAGE_GATE_FAILED', 'MARKET_COMPARABLES_MISSING', 'RIGHTS_DECLARATION_MISSING'],
    consumers: ['SG06_READINESS_VERIFICATION', 'SG08_LISTING_ACTIVATION'],
    uiExposed: true,
    certificationStatus: 'partial',
    fitGapStatus: 'gap',
    notes: 'Public pages describe required package. Server-side package verification remains a missing implementation gap.',
  },
  {
    sequence: 6,
    stageId: 'SG06_READINESS_VERIFICATION',
    processName: 'Storygate Readiness Verification',
    activeState: 'active',
    supplier: 'RevisionGrade evaluation or qualified professional assessment',
    inputArtifacts: ['package_verification_result_v1', 'screening_result_v1'],
    inputRequiredFields: ['readiness_score_or_equivalent', 'readinessThreshold'],
    inputMetrics: ['readiness_gate_pass_rate', 'readiness_score'],
    codeSurfaces: ['app/storygate-studio/page.tsx', 'app/storygate-studio/apply/page.tsx'],
    processContract: 'Storygate Studio admission requires 9.0/10 or an explicit qualified professional equivalent. RevisionGrade readiness below 9.0 may be useful for revise/package preparation, but it does not satisfy Storygate admission.',
    outputArtifacts: ['storygate_eligibility_result_v1'],
    outputRequiredFields: ['packageGatePass', 'readinessGatePass', 'rightsGatePass', 'eligible', 'readinessThreshold'],
    outputMetrics: ['readiness_gate_pass_rate'],
    forwardKick: 'SG07_INDUSTRY_VERIFICATION and SG08_LISTING_ACTIVATION (if eligible)',
    backwardKick: 'SG01_CREATOR_SUBMISSION or Revise Factory (if below threshold)',
    dirtyDataRules: ['No registry, SIPOC, CSV, app route, or test may define Storygate admission as 8.0.'],
    failureCodes: ['SCORE_BELOW_THRESHOLD', 'EQUIVALENT_ASSESSMENT_UNVERIFIED'],
    consumers: ['SG08_LISTING_ACTIVATION'],
    uiExposed: true,
    certificationStatus: 'partial',
    fitGapStatus: 'gap',
    notes: '9.0 threshold is locked by STORYGATE_STUDIO_CANON.md and guard tests.',
  },
  {
    sequence: 7,
    stageId: 'SG07_INDUSTRY_VERIFICATION',
    processName: 'Industry Verification Gate',
    activeState: 'active',
    supplier: 'Publishing professional / admin verifier',
    inputArtifacts: ['industry_verification_request_v1'],
    inputRequiredFields: ['requester_id', 'professional_identity', 'verification_state'],
    inputMetrics: ['verification_request_count', 'verified_professional_count'],
    codeSurfaces: ['app/storygate-studio/industry/page.tsx', 'app/storygate-studio/industry/dashboard/page.tsx'],
    processContract: 'Only verified publishing professionals or admins may see full listings or request project access. Verification state is admin-controlled and auditable; unverified users may only see sign-in/request-access shells.',
    outputArtifacts: ['industry_verification_record_v1'],
    outputRequiredFields: ['requester_id', 'verification_state'],
    outputMetrics: ['verification_pass_rate', 'unverified_block_count'],
    forwardKick: 'SG09_ACCESS_REQUEST (if verified)',
    backwardKick: 'SG07_INDUSTRY_VERIFICATION (remain unverified until admin approval)',
    dirtyDataRules: ['Verified badge must reflect persisted server-side verification state, not client-side display state.'],
    failureCodes: ['UNVERIFIED_INDUSTRY_USER', 'VERIFICATION_STATE_UNAUDITED', 'NON_ADMIN_VERIFICATION_ATTEMPT'],
    consumers: ['SG09_ACCESS_REQUEST', 'SG11_CONTROLLED_ACCESS'],
    uiExposed: true,
    certificationStatus: 'missing_critical',
    fitGapStatus: 'critical',
    notes: 'Current route is a sign-in/request shell. Professional verification enforcement proof is required before SIPOC-enforced status.',
  },
  {
    sequence: 8,
    stageId: 'SG08_LISTING_ACTIVATION',
    processName: 'Storygate Listing Activation',
    activeState: 'planned_required',
    supplier: 'Creator/admin activation action after eligibility pass',
    inputArtifacts: ['storygate_eligibility_result_v1', 'package_verification_result_v1'],
    inputRequiredFields: ['manuscript_id', 'title', 'visibility', 'access_requires_approval'],
    inputMetrics: ['listing_create_latency_ms', 'duplicate_listing_block_count'],
    codeSurfaces: ['docs/storygate/STORYGATE_STUDIO_CANON.md'],
    processContract: 'Activate eligible project only. Listing starts private/restricted, requires approval for access, is owned by creator, and must not become publicly searchable.',
    outputArtifacts: ['project_listing_v1', 'access_log_event_v1'],
    outputRequiredFields: ['listing_id', 'manuscript_id', 'creator_email', 'visibility', 'access_requires_approval'],
    outputMetrics: ['private_listing_count', 'listing_created_log_count'],
    forwardKick: 'SG09_ACCESS_REQUEST',
    backwardKick: 'SG05_PACKAGE_VERIFICATION or SG06_READINESS_VERIFICATION (if eligibility fails)',
    dirtyDataRules: ['Listing visibility must start private/restricted by default.', 'Duplicate listing for same manuscript + creator must be blocked.'],
    failureCodes: ['MANUSCRIPT_NOT_FINAL', 'LISTING_ALREADY_EXISTS', 'ELIGIBILITY_NOT_PROVEN'],
    consumers: ['SG09_ACCESS_REQUEST', 'SG11_CONTROLLED_ACCESS'],
    uiExposed: false,
    certificationStatus: 'missing_critical',
    fitGapStatus: 'critical',
    notes: 'Current-canon listing activation route/persistence is not certified in this repo snapshot.',
  },
  {
    sequence: 9,
    stageId: 'SG09_ACCESS_REQUEST',
    processName: 'Industry Access Request',
    activeState: 'planned_required',
    supplier: 'Verified publishing professional',
    inputArtifacts: ['project_listing_v1', 'industry_verification_record_v1'],
    inputRequiredFields: ['listing_id', 'requester_id', 'verification_state'],
    inputMetrics: ['access_request_count', 'request_to_decision_latency_ms'],
    codeSurfaces: ['docs/SIPOC_STORYGATE_PROCESS.md'],
    processContract: 'Verified professional requests access to one project listing. Request creates durable access_request_v1 tied to requester + project. No access is granted at request time.',
    outputArtifacts: ['access_request_v1'],
    outputRequiredFields: ['request_id', 'listing_id', 'requester_id', 'decision'],
    outputMetrics: ['pending_access_request_count'],
    forwardKick: 'SG10_CREATOR_ADMIN_APPROVAL',
    backwardKick: 'SG07_INDUSTRY_VERIFICATION (if requester is not verified)',
    dirtyDataRules: ['Access request must not grant access automatically.'],
    failureCodes: ['UNAUTHENTICATED', 'UNVERIFIED_INDUSTRY_USER', 'LISTING_NOT_ACTIVE', 'ACCESS_REQUEST_NOT_CREATED'],
    consumers: ['SG10_CREATOR_ADMIN_APPROVAL'],
    uiExposed: true,
    certificationStatus: 'missing_critical',
    fitGapStatus: 'critical',
    notes: 'No concrete current route/function is present in this repo snapshot.',
  },
  {
    sequence: 10,
    stageId: 'SG10_CREATOR_ADMIN_APPROVAL',
    processName: 'Creator/Admin Access Approval',
    activeState: 'planned_required',
    supplier: 'Creator or admin',
    inputArtifacts: ['access_request_v1', 'project_listing_v1'],
    inputRequiredFields: ['request_id', 'listing_id', 'creator_id', 'decision'],
    inputMetrics: ['approval_rate', 'denial_rate'],
    codeSurfaces: ['docs/SIPOC_STORYGATE_PROCESS.md'],
    processContract: 'Creator or admin approves or denies each access request. Approval creates active grant and logs approval. Denial logs denial and does not create grant. Optional artifact visibility limits may be attached to grant.',
    outputArtifacts: ['access_unlock_grant_v1', 'access_decision_event_v1'],
    outputRequiredFields: ['request_id', 'decision', 'access_granted'],
    outputMetrics: ['active_grant_count', 'denial_event_count'],
    forwardKick: 'SG11_CONTROLLED_ACCESS (if approved)',
    backwardKick: 'SG09_ACCESS_REQUEST (if denied or more info needed)',
    dirtyDataRules: ['Only creator or admin may approve access for the project.', 'Denied requests must not create grants.'],
    failureCodes: ['APPROVAL_ACTOR_NOT_AUTHORIZED', 'ACCESS_REQUEST_NOT_FOUND', 'NON_CANONICAL_ACCESS_DECISION'],
    consumers: ['SG11_CONTROLLED_ACCESS', 'SG12_ACCESS_LOGGING_REVOCATION'],
    uiExposed: true,
    certificationStatus: 'missing_critical',
    fitGapStatus: 'critical',
    notes: 'Creator/admin approval is core Storygate protection and remains missing-critical until proven.',
  },
  {
    sequence: 11,
    stageId: 'SG11_CONTROLLED_ACCESS',
    processName: 'Controlled Access and Viewing',
    activeState: 'planned_required',
    supplier: 'Verified professional with active grant',
    inputArtifacts: ['access_unlock_grant_v1', 'project_listing_v1'],
    inputRequiredFields: ['grant_id', 'listing_id', 'requester_id', 'allowed_artifacts'],
    inputMetrics: ['view_count', 'download_count'],
    codeSurfaces: ['docs/SIPOC_STORYGATE_PROCESS.md'],
    processContract: 'Approved verified professional may view only creator-approved artifacts for the granted project. All views/downloads must be logged. Materials are not a public download library.',
    outputArtifacts: ['controlled_access_view_v1', 'access_log_event_v1'],
    outputRequiredFields: ['listing_id', 'requester_id', 'allowed_artifacts', 'action_type'],
    outputMetrics: ['logged_view_count', 'logged_download_count'],
    forwardKick: 'SG12_ACCESS_LOGGING_REVOCATION',
    backwardKick: 'SG10_CREATOR_ADMIN_APPROVAL (if grant missing or expired)',
    dirtyDataRules: ['Do not expose artifacts outside the approved grant scope.', 'Every view/download must create an access log event.'],
    failureCodes: ['ACCESS_GRANT_MISSING', 'ARTIFACT_NOT_ALLOWED', 'PRIVATE_LISTING_BLOCKED', 'ACCESS_LOG_WRITE_FAILED'],
    consumers: ['SG12_ACCESS_LOGGING_REVOCATION'],
    uiExposed: true,
    certificationStatus: 'missing_critical',
    fitGapStatus: 'critical',
    notes: 'Controlled viewing route is not present/certified in this repo snapshot.',
  },
  {
    sequence: 12,
    stageId: 'SG12_ACCESS_LOGGING_REVOCATION',
    processName: 'Access Logging, Audit, and Revocation',
    activeState: 'planned_required',
    supplier: 'System access logger / creator-admin revocation action',
    inputArtifacts: ['controlled_access_view_v1', 'access_unlock_grant_v1'],
    inputRequiredFields: ['action_type', 'listing_id', 'requester_id', 'timestamp_utc'],
    inputMetrics: ['audit_event_count', 'revocation_count'],
    codeSurfaces: ['docs/SIPOC_STORYGATE_PROCESS.md'],
    processContract: 'Record append-only audit for listing activation, access request, grant, denial, view/download, verification, and revocation. Revocation terminates future access without deleting historical logs.',
    outputArtifacts: ['access_log_event_v1', 'access_revocation_record_v1'],
    outputRequiredFields: ['event_id', 'action_type', 'listing_id', 'requester_id', 'timestamp_utc'],
    outputMetrics: ['audit_completeness_rate', 'revoked_grant_count'],
    forwardKick: 'none — terminal audit/revocation stage',
    backwardKick: 'SG10_CREATOR_ADMIN_APPROVAL or SG11_CONTROLLED_ACCESS (depending on invalid grant/access state)',
    dirtyDataRules: ['AccessLog must be append-only.', 'Revocation must not delete historical evidence.'],
    failureCodes: ['AUDIT_EVENT_MISSING', 'STRUCTURED_AUDIT_FIELDS_MISSING', 'REVOCATION_NOT_PERSISTED', 'ACCESS_CONTROL_BYPASS'],
    consumers: ['Admin audit surfaces', 'Creator access dashboard', 'Governance review'],
    uiExposed: true,
    certificationStatus: 'missing_critical',
    fitGapStatus: 'critical',
    notes: 'Structured audit, SLA, and revocation persistence remain missing-critical.',
  },
] as const;

export interface StorygateArtifactEntry {
  artifact: string;
  producerStageId: string;
  consumerStageIds: string[];
  requiredFields: string[];
  completenessMetric: string;
  accuracyMetric: string;
  dirtyDataRule: string;
  regenerationOwnerStageId: string;
  requiredForControlledAccess: boolean;
  fitGapStatus: StorygateFitGapStatus;
}

export const STORYGATE_ARTIFACT_REGISTRY: readonly StorygateArtifactEntry[] = [
  { artifact: 'agent_readiness_package_v1', producerStageId: 'AGENT_READINESS_FACTORY (external)', consumerStageIds: ['SG01_CREATOR_SUBMISSION', 'SG05_PACKAGE_VERIFICATION'], requiredFields: REQUIRED_PACKAGE_FIELDS, completenessMetric: 'all required Storygate package sections present and creator-approved', accuracyMetric: 'package reflects creator-approved materials, not inferred content', dirtyDataRule: 'Do not submit generated package content unless creator approved it for Storygate consideration. Current Agent Readiness six-section output must be supplemented with market category, target audience, market position statement, sample pages/materials, and rights declaration before Storygate package verification can pass.', regenerationOwnerStageId: 'AGENT_READINESS_FACTORY (external)', requiredForControlledAccess: false, fitGapStatus: 'gap' },
  { artifact: 'storygate_submission_request_v1', producerStageId: 'SG01_CREATOR_SUBMISSION', consumerStageIds: ['SG02_INTAKE_VALIDATION', 'SG03_INTERNAL_SCREENING'], requiredFields: ['project_title', 'primary_genre', 'creator_name', 'creator_email', ...REQUIRED_PACKAGE_FIELDS], completenessMetric: 'all required intake/package fields present', accuracyMetric: 'creator contact and project metadata reflect submitted project', dirtyDataRule: 'Unsupported film/screen/adaptation scope must be rejected.', regenerationOwnerStageId: 'SG01_CREATOR_SUBMISSION', requiredForControlledAccess: false, fitGapStatus: 'ok' },
  { artifact: 'intake_validation_result_v1', producerStageId: 'SG02_INTAKE_VALIDATION', consumerStageIds: ['SG03_INTERNAL_SCREENING'], requiredFields: ['valid', 'failureCodes'], completenessMetric: 'all required validators return pass/fail', accuracyMetric: 'failureCodes map to actual invalid fields', dirtyDataRule: 'Validation result must not hide system/database errors as client errors.', regenerationOwnerStageId: 'SG02_INTAKE_VALIDATION', requiredForControlledAccess: false, fitGapStatus: 'gap' },
  { artifact: 'screening_result_v1', producerStageId: 'SG03_INTERNAL_SCREENING', consumerStageIds: ['SG04_TIER_ASSIGNMENT', 'SG06_READINESS_VERIFICATION'], requiredFields: ['screeningStatus', 'screeningReasons'], completenessMetric: 'screeningStatus and screeningReasons both persisted', accuracyMetric: 'screening reason codes match actual failed gates', dirtyDataRule: 'Storygate admission threshold must be 9.0.', regenerationOwnerStageId: 'SG03_INTERNAL_SCREENING', requiredForControlledAccess: false, fitGapStatus: 'critical' },
  { artifact: 'tier_assignment_v1', producerStageId: 'SG04_TIER_ASSIGNMENT', consumerStageIds: ['SG05_PACKAGE_VERIFICATION'], requiredFields: ['tier', 'submission_id', 'reviewer_notes'], completenessMetric: 'one internal tier assigned per screened submission', accuracyMetric: 'tier reflects reviewer action rather than public inference', dirtyDataRule: 'Tier assignment must not create industry visibility.', regenerationOwnerStageId: 'SG04_TIER_ASSIGNMENT', requiredForControlledAccess: false, fitGapStatus: 'critical' },
  { artifact: 'package_verification_result_v1', producerStageId: 'SG05_PACKAGE_VERIFICATION', consumerStageIds: ['SG06_READINESS_VERIFICATION', 'SG08_LISTING_ACTIVATION'], requiredFields: ['packageGatePass', ...REQUIRED_PACKAGE_FIELDS], completenessMetric: 'all required package fields explicitly verified', accuracyMetric: 'packageGatePass true iff every required package field is present', dirtyDataRule: 'Market comparables, market category, target audience, market position statement, and rights declaration must not be optional.', regenerationOwnerStageId: 'SG05_PACKAGE_VERIFICATION', requiredForControlledAccess: false, fitGapStatus: 'gap' },
  { artifact: 'storygate_eligibility_result_v1', producerStageId: 'SG06_READINESS_VERIFICATION', consumerStageIds: ['SG08_LISTING_ACTIVATION'], requiredFields: ['packageGatePass', 'readinessGatePass', 'rightsGatePass', 'eligible', 'readinessThreshold'], completenessMetric: 'all eligibility gates have explicit boolean result', accuracyMetric: 'eligible=true iff package, readiness/equivalent, and rights gates pass', dirtyDataRule: 'Do not promote below 9.0 without explicit qualified equivalent assessment.', regenerationOwnerStageId: 'SG06_READINESS_VERIFICATION', requiredForControlledAccess: false, fitGapStatus: 'gap' },
  { artifact: 'industry_verification_request_v1', producerStageId: 'SG07_INDUSTRY_VERIFICATION', consumerStageIds: ['SG07_INDUSTRY_VERIFICATION'], requiredFields: ['requester_id', 'professional_identity'], completenessMetric: 'requester identity details submitted', accuracyMetric: 'professional identity can be verified by admin', dirtyDataRule: 'Do not grant verified state from client-side assertions.', regenerationOwnerStageId: 'SG07_INDUSTRY_VERIFICATION', requiredForControlledAccess: true, fitGapStatus: 'critical' },
  { artifact: 'industry_verification_record_v1', producerStageId: 'SG07_INDUSTRY_VERIFICATION', consumerStageIds: ['SG09_ACCESS_REQUEST', 'SG11_CONTROLLED_ACCESS'], requiredFields: ['requester_id', 'verification_state'], completenessMetric: 'verification_state persisted as verified or unverified', accuracyMetric: 'verified state reflects admin-controlled decision', dirtyDataRule: 'Verification state must not be spoofable in UI.', regenerationOwnerStageId: 'SG07_INDUSTRY_VERIFICATION', requiredForControlledAccess: true, fitGapStatus: 'critical' },
  { artifact: 'project_listing_v1', producerStageId: 'SG08_LISTING_ACTIVATION', consumerStageIds: ['SG09_ACCESS_REQUEST', 'SG10_CREATOR_ADMIN_APPROVAL', 'SG11_CONTROLLED_ACCESS'], requiredFields: ['listing_id', 'manuscript_id', 'creator_email', 'visibility', 'access_requires_approval'], completenessMetric: 'listing exists with private/restricted default and creator ownership', accuracyMetric: 'listing fields derive from eligible submission/final manuscript', dirtyDataRule: 'Listings must not be publicly searchable.', regenerationOwnerStageId: 'SG08_LISTING_ACTIVATION', requiredForControlledAccess: true, fitGapStatus: 'critical' },
  { artifact: 'access_request_v1', producerStageId: 'SG09_ACCESS_REQUEST', consumerStageIds: ['SG10_CREATOR_ADMIN_APPROVAL'], requiredFields: ['request_id', 'listing_id', 'requester_id', 'decision'], completenessMetric: 'one request record per requester/listing access attempt', accuracyMetric: 'decision starts as requested and does not imply grant', dirtyDataRule: 'Access request must not create active access grant automatically.', regenerationOwnerStageId: 'SG09_ACCESS_REQUEST', requiredForControlledAccess: true, fitGapStatus: 'critical' },
  { artifact: 'access_unlock_grant_v1', producerStageId: 'SG10_CREATOR_ADMIN_APPROVAL', consumerStageIds: ['SG11_CONTROLLED_ACCESS', 'SG12_ACCESS_LOGGING_REVOCATION'], requiredFields: ['grant_id', 'listing_id', 'requester_id', 'allowed_artifacts'], completenessMetric: 'active grant exists only after creator/admin approval', accuracyMetric: 'grant scope matches creator-approved artifact visibility', dirtyDataRule: 'Denied requests must not produce access grants.', regenerationOwnerStageId: 'SG10_CREATOR_ADMIN_APPROVAL', requiredForControlledAccess: true, fitGapStatus: 'critical' },
  { artifact: 'access_decision_event_v1', producerStageId: 'SG10_CREATOR_ADMIN_APPROVAL', consumerStageIds: ['SG12_ACCESS_LOGGING_REVOCATION'], requiredFields: ['request_id', 'decision', 'access_granted'], completenessMetric: 'approval or denial event captured for every request decision', accuracyMetric: 'access_granted boolean matches decision', dirtyDataRule: 'Approval/denial must be auditable and actor-scoped.', regenerationOwnerStageId: 'SG10_CREATOR_ADMIN_APPROVAL', requiredForControlledAccess: false, fitGapStatus: 'critical' },
  { artifact: 'controlled_access_view_v1', producerStageId: 'SG11_CONTROLLED_ACCESS', consumerStageIds: ['SG12_ACCESS_LOGGING_REVOCATION'], requiredFields: ['listing_id', 'requester_id', 'allowed_artifacts', 'action_type'], completenessMetric: 'every view/download has listing, requester, and artifact scope', accuracyMetric: 'viewed artifacts are within active grant allowed_artifacts', dirtyDataRule: 'Do not expose artifacts outside grant scope.', regenerationOwnerStageId: 'SG11_CONTROLLED_ACCESS', requiredForControlledAccess: true, fitGapStatus: 'critical' },
  { artifact: 'access_log_event_v1', producerStageId: 'SG12_ACCESS_LOGGING_REVOCATION', consumerStageIds: ['Governance review', 'Admin audit surfaces'], requiredFields: ['event_id', 'action_type', 'listing_id', 'requester_id', 'timestamp_utc'], completenessMetric: 'all state-changing and view/download actions logged', accuracyMetric: 'event actor, listing, verification, and grant context match source action', dirtyDataRule: 'Structured audit fields required for SIPOC-enforced status.', regenerationOwnerStageId: 'SG12_ACCESS_LOGGING_REVOCATION', requiredForControlledAccess: true, fitGapStatus: 'critical' },
  { artifact: 'access_revocation_record_v1', producerStageId: 'SG12_ACCESS_LOGGING_REVOCATION', consumerStageIds: ['SG11_CONTROLLED_ACCESS'], requiredFields: ['grant_id', 'revoked_by', 'timestamp_utc'], completenessMetric: 'revocation record exists when active grant is revoked', accuracyMetric: 'revoked grant blocks future access without deleting historical logs', dirtyDataRule: 'Revocation must be append-only and must not rewrite prior access evidence.', regenerationOwnerStageId: 'SG12_ACCESS_LOGGING_REVOCATION', requiredForControlledAccess: true, fitGapStatus: 'critical' },
] as const;

export interface StorygateFieldEntry {
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

export const STORYGATE_FIELD_REGISTRY: readonly StorygateFieldEntry[] = [
  { field: 'project_title', artifact: 'storygate_submission_request_v1', required: true, nullable: false, sourceStageId: 'SG01_CREATOR_SUBMISSION', validatorStageId: 'SG02_INTAKE_VALIDATION', uiRendered: true, notes: 'Creator-supplied title.' },
  { field: 'primary_genre', artifact: 'storygate_submission_request_v1', required: true, nullable: false, sourceStageId: 'SG01_CREATOR_SUBMISSION', validatorStageId: 'SG02_INTAKE_VALIDATION', uiRendered: true, notes: 'Genre/market lane metadata.' },
  { field: 'creator_name', artifact: 'storygate_submission_request_v1', required: true, nullable: false, sourceStageId: 'SG01_CREATOR_SUBMISSION', validatorStageId: 'SG02_INTAKE_VALIDATION', uiRendered: false, notes: 'Creator contact identity.' },
  { field: 'creator_email', artifact: 'storygate_submission_request_v1', required: true, nullable: false, sourceStageId: 'SG01_CREATOR_SUBMISSION', validatorStageId: 'SG02_INTAKE_VALIDATION', uiRendered: false, notes: 'Creator contact email.' },
  { field: 'query_letter', artifact: 'agent_readiness_package_v1', required: true, nullable: false, sourceStageId: 'SG01_CREATOR_SUBMISSION', validatorStageId: 'SG05_PACKAGE_VERIFICATION', uiRendered: true, notes: 'Required Storygate package field.' },
  { field: 'synopsis', artifact: 'agent_readiness_package_v1', required: true, nullable: false, sourceStageId: 'SG01_CREATOR_SUBMISSION', validatorStageId: 'SG05_PACKAGE_VERIFICATION', uiRendered: true, notes: 'Required Storygate package field.' },
  { field: 'author_bio', artifact: 'agent_readiness_package_v1', required: true, nullable: false, sourceStageId: 'SG01_CREATOR_SUBMISSION', validatorStageId: 'SG05_PACKAGE_VERIFICATION', uiRendered: true, notes: 'Required Storygate package field.' },
  { field: 'elevator_pitch', artifact: 'agent_readiness_package_v1', required: true, nullable: false, sourceStageId: 'SG01_CREATOR_SUBMISSION', validatorStageId: 'SG05_PACKAGE_VERIFICATION', uiRendered: true, notes: 'Required Storygate package field.' },
  { field: 'agent_pitch', artifact: 'agent_readiness_package_v1', required: true, nullable: false, sourceStageId: 'SG01_CREATOR_SUBMISSION', validatorStageId: 'SG05_PACKAGE_VERIFICATION', uiRendered: true, notes: 'Required Storygate package field.' },
  { field: 'market_comparables', artifact: 'agent_readiness_package_v1', required: true, nullable: false, sourceStageId: 'SG01_CREATOR_SUBMISSION', validatorStageId: 'SG05_PACKAGE_VERIFICATION', uiRendered: true, notes: 'Required Storygate package field; comparables are not optional for Storygate admission.' },
  { field: 'market_category', artifact: 'agent_readiness_package_v1', required: true, nullable: false, sourceStageId: 'SG01_CREATOR_SUBMISSION', validatorStageId: 'SG05_PACKAGE_VERIFICATION', uiRendered: true, notes: 'Required Storygate package field; identifies the operational publishing category such as upmarket suspense, commercial thriller, literary fiction, historical mystery, speculative eco-thriller, or middle grade fantasy.' },
  { field: 'target_audience', artifact: 'agent_readiness_package_v1', required: true, nullable: false, sourceStageId: 'SG01_CREATOR_SUBMISSION', validatorStageId: 'SG05_PACKAGE_VERIFICATION', uiRendered: true, notes: 'Required Storygate package field; identifies the intended readership and buying audience.' },
  { field: 'market_position_statement', artifact: 'agent_readiness_package_v1', required: true, nullable: false, sourceStageId: 'SG01_CREATOR_SUBMISSION', validatorStageId: 'SG05_PACKAGE_VERIFICATION', uiRendered: true, notes: 'Required Storygate package field; explains where the manuscript sits on the publishing shelf beyond comparables alone.' },
  { field: 'sample_pages', artifact: 'agent_readiness_package_v1', required: true, nullable: false, sourceStageId: 'SG01_CREATOR_SUBMISSION', validatorStageId: 'SG05_PACKAGE_VERIFICATION', uiRendered: true, notes: 'Required Storygate package field.' },
  { field: 'rights_declaration', artifact: 'agent_readiness_package_v1', required: true, nullable: false, canonicalValues: ['confirmed'], sourceStageId: 'SG01_CREATOR_SUBMISSION', validatorStageId: 'SG05_PACKAGE_VERIFICATION', uiRendered: true, notes: 'Required explicit rights confirmation.' },
  { field: 'status', artifact: 'storygate_submission_request_v1', required: true, nullable: false, canonicalValues: ['SUBMITTED', 'REVIEWING', 'DECLINED', 'HOLD', 'APPROVED'], sourceStageId: 'SG01_CREATOR_SUBMISSION', validatorStageId: 'SG03_INTERNAL_SCREENING', uiRendered: false, notes: 'Canonical internal submission status set.' },
  { field: 'screeningStatus', artifact: 'screening_result_v1', required: true, nullable: false, canonicalValues: ['ELIGIBLE', 'AUTO_DECLINED', 'RECOMMEND_HUMAN_REVIEW'], sourceStageId: 'SG03_INTERNAL_SCREENING', validatorStageId: 'SG03_INTERNAL_SCREENING', uiRendered: false, notes: 'Creator-safe screening outcome.' },
  { field: 'tier', artifact: 'tier_assignment_v1', required: true, nullable: false, canonicalValues: ['Tier 1', 'Tier 2', 'Tier 3'], sourceStageId: 'SG04_TIER_ASSIGNMENT', validatorStageId: 'SG04_TIER_ASSIGNMENT', uiRendered: false, notes: 'Internal review tier only.' },
  { field: 'eligible', artifact: 'storygate_eligibility_result_v1', required: true, nullable: false, canonicalValues: ['true', 'false'], sourceStageId: 'SG06_READINESS_VERIFICATION', validatorStageId: 'SG06_READINESS_VERIFICATION', uiRendered: true, notes: 'true iff package, 9.0/equivalent readiness, and rights gates all pass.' },
  { field: 'readinessThreshold', artifact: 'storygate_eligibility_result_v1', required: true, nullable: false, canonicalValues: ['9.0'], sourceStageId: 'SG06_READINESS_VERIFICATION', validatorStageId: 'SG06_READINESS_VERIFICATION', uiRendered: true, notes: 'Canonical Storygate Studio admission threshold. RevisionGrade readiness and Storygate admission are separate gates.' },
  { field: 'visibility', artifact: 'project_listing_v1', required: true, nullable: false, canonicalValues: ['private', 'restricted', 'active'], sourceStageId: 'SG08_LISTING_ACTIVATION', validatorStageId: 'SG08_LISTING_ACTIVATION', uiRendered: false, notes: 'Listing starts private/restricted by default.' },
  { field: 'access_requires_approval', artifact: 'project_listing_v1', required: true, nullable: false, canonicalValues: ['true'], sourceStageId: 'SG08_LISTING_ACTIVATION', validatorStageId: 'SG10_CREATOR_ADMIN_APPROVAL', uiRendered: false, notes: 'Creator/admin approval required before controlled access.' },
  { field: 'verification_state', artifact: 'industry_verification_record_v1', required: true, nullable: false, canonicalValues: ['verified', 'unverified'], sourceStageId: 'SG07_INDUSTRY_VERIFICATION', validatorStageId: 'SG07_INDUSTRY_VERIFICATION', uiRendered: true, notes: 'Admin-controlled trust signal.' },
  { field: 'decision', artifact: 'access_request_v1', required: true, nullable: false, canonicalValues: ['requested', 'approved', 'denied', 'revoked'], sourceStageId: 'SG09_ACCESS_REQUEST', validatorStageId: 'SG10_CREATOR_ADMIN_APPROVAL', uiRendered: true, notes: 'Access request lifecycle decision; no automatic grant on requested.' },
  { field: 'allowed_artifacts', artifact: 'access_unlock_grant_v1', required: true, nullable: false, sourceStageId: 'SG10_CREATOR_ADMIN_APPROVAL', validatorStageId: 'SG11_CONTROLLED_ACCESS', uiRendered: true, notes: 'Creator-approved artifact subset for a requester/listing grant.' },
  { field: 'action_type', artifact: 'access_log_event_v1', required: true, nullable: false, canonicalValues: ['listing_created', 'request_access', 'grant_access', 'deny_access', 'view', 'download', 'verify_industry', 'revoke_access'], sourceStageId: 'SG12_ACCESS_LOGGING_REVOCATION', validatorStageId: 'SG12_ACCESS_LOGGING_REVOCATION', uiRendered: false, notes: 'Structured action type required for audit.' },
  { field: 'validators_run', artifact: 'access_log_event_v1', required: true, nullable: false, sourceStageId: 'SG12_ACCESS_LOGGING_REVOCATION', validatorStageId: 'SG12_ACCESS_LOGGING_REVOCATION', uiRendered: false, notes: 'Required before SIPOC-enforced status.' },
  { field: 'failure_codes', artifact: 'access_log_event_v1', required: true, nullable: true, sourceStageId: 'SG12_ACCESS_LOGGING_REVOCATION', validatorStageId: 'SG12_ACCESS_LOGGING_REVOCATION', uiRendered: false, notes: 'Required; empty array on pass.' },
] as const;

export interface StorygateKickEntry {
  kickCode: string;
  detectedAt: string;
  description: string;
  blocking: boolean;
  blocksControlledAccess: boolean;
  remediation: string;
  httpStatus: number;
}

export const STORYGATE_KICK_MATRIX: readonly StorygateKickEntry[] = [
  { kickCode: 'UNAUTHENTICATED', detectedAt: 'SG01_CREATOR_SUBMISSION', description: 'Request has no valid user session.', blocking: true, blocksControlledAccess: true, remediation: 'User must sign in before submitting or requesting access.', httpStatus: 401 },
  { kickCode: 'MISSING_REQUIRED_FIELDS', detectedAt: 'SG02_INTAKE_VALIDATION', description: 'Required Storygate intake/package fields are missing.', blocking: true, blocksControlledAccess: false, remediation: 'Creator must complete all required fields.', httpStatus: 400 },
  { kickCode: 'MARKET_COMPARABLES_MISSING', detectedAt: 'SG05_PACKAGE_VERIFICATION', description: 'Market comparables are missing from Storygate package.', blocking: true, blocksControlledAccess: true, remediation: 'Add market comparables with positioning rationale.', httpStatus: 422 },
  { kickCode: 'RIGHTS_DECLARATION_MISSING', detectedAt: 'SG05_PACKAGE_VERIFICATION', description: 'Rights declaration is absent.', blocking: true, blocksControlledAccess: true, remediation: 'Creator must confirm rights before listing activation.', httpStatus: 422 },
  { kickCode: 'FORBIDDEN_SCOPE_REQUESTED', detectedAt: 'SG02_INTAKE_VALIDATION', description: 'Request tries to use film/screen/adaptation/producer-facing scope that is not current Storygate Studio canon.', blocking: true, blocksControlledAccess: true, remediation: 'Route back to manuscript-first publishing package only.', httpStatus: 400 },
  { kickCode: 'SCORE_BELOW_THRESHOLD', detectedAt: 'SG06_READINESS_VERIFICATION', description: 'Readiness score is below canonical Storygate 9.0/10 floor or equivalent professional assessment is missing.', blocking: true, blocksControlledAccess: true, remediation: 'Creator must revise, obtain equivalent assessment, or resubmit when ready.', httpStatus: 422 },
  { kickCode: 'PACKAGE_GATE_FAILED', detectedAt: 'SG05_PACKAGE_VERIFICATION', description: 'Professional manuscript package is missing or incomplete.', blocking: true, blocksControlledAccess: true, remediation: 'Creator must supply a complete Storygate package.', httpStatus: 422 },
  { kickCode: 'MANUSCRIPT_NOT_FINAL', detectedAt: 'SG08_LISTING_ACTIVATION', description: 'Listing activation attempted for non-final manuscript.', blocking: true, blocksControlledAccess: true, remediation: 'Complete revision before listing.', httpStatus: 400 },
  { kickCode: 'LISTING_ALREADY_EXISTS', detectedAt: 'SG08_LISTING_ACTIVATION', description: 'Duplicate listing for same manuscript and creator.', blocking: true, blocksControlledAccess: false, remediation: 'Use existing listing or create governed update path.', httpStatus: 400 },
  { kickCode: 'UNVERIFIED_INDUSTRY_USER', detectedAt: 'SG07_INDUSTRY_VERIFICATION', description: 'Requester is not verified as a publishing professional.', blocking: true, blocksControlledAccess: true, remediation: 'Complete professional verification before browsing/requesting access.', httpStatus: 403 },
  { kickCode: 'ACCESS_REQUEST_NOT_CREATED', detectedAt: 'SG09_ACCESS_REQUEST', description: 'Access request was not durably created.', blocking: true, blocksControlledAccess: true, remediation: 'Do not grant access without request record.', httpStatus: 500 },
  { kickCode: 'APPROVAL_ACTOR_NOT_AUTHORIZED', detectedAt: 'SG10_CREATOR_ADMIN_APPROVAL', description: 'Non-creator/non-admin attempted to approve access.', blocking: true, blocksControlledAccess: true, remediation: 'Restrict approval to project creator or admin.', httpStatus: 403 },
  { kickCode: 'ACCESS_GRANT_MISSING', detectedAt: 'SG11_CONTROLLED_ACCESS', description: 'Requester attempted controlled view without active grant.', blocking: true, blocksControlledAccess: true, remediation: 'Require approved grant before view/download.', httpStatus: 403 },
  { kickCode: 'ARTIFACT_NOT_ALLOWED', detectedAt: 'SG11_CONTROLLED_ACCESS', description: 'Requester attempted to view/download artifact outside approved scope.', blocking: true, blocksControlledAccess: true, remediation: 'Restrict response to allowed_artifacts.', httpStatus: 403 },
  { kickCode: 'STRUCTURED_AUDIT_FIELDS_MISSING', detectedAt: 'SG12_ACCESS_LOGGING_REVOCATION', description: 'Audit event is missing governance-required structured fields.', blocking: true, blocksControlledAccess: true, remediation: 'Write validators_run, validators_failed, failure_codes, verification_state, canon_hash, and SLA timing.', httpStatus: 500 },
] as const;

export interface StorygateAuthoritySourceEntry {
  authorityId: string;
  family: StorygateAuthorityFamily;
  authorityLevel: StorygateAuthorityLevel;
  title: string;
  path: string;
  appliesToStageIds: string[];
  appliesToArtifacts: string[];
  executionUse: string;
  notes: string;
}

export const STORYGATE_AUTHORITY_SOURCE_REGISTRY: readonly StorygateAuthoritySourceEntry[] = [
  { authorityId: 'AI_GOVERNANCE', family: 'governance', authorityLevel: 'binding', title: 'AI Governance', path: 'AI_GOVERNANCE.md', appliesToStageIds: STORYGATE_PROCESS_REGISTRY.map((stage) => stage.stageId), appliesToArtifacts: ['storygate_submission_request_v1', 'project_listing_v1', 'access_log_event_v1'], executionUse: 'Binding governance for explicit failure, passive observability, and no masked system/database errors.', notes: 'All Storygate access and audit rules inherit AI_GOVERNANCE.md.' },
  { authorityId: 'STORYGATE_STUDIO_CANON', family: 'doctrine', authorityLevel: 'binding', title: 'Storygate Studio Canon', path: 'docs/storygate/STORYGATE_STUDIO_CANON.md', appliesToStageIds: STORYGATE_PROCESS_REGISTRY.map((stage) => stage.stageId), appliesToArtifacts: STORYGATE_ARTIFACT_REGISTRY.map((artifact) => artifact.artifact), executionUse: 'Primary current Storygate Studio source of truth: 9.0 admission threshold, required package, no film/screen/adaptation scope, and Base44 legacy-only policy.', notes: 'This file supersedes Base44 Storygate materials for current governance.' },
  { authorityId: 'SIPOC_STORYGATE', family: 'doctrine', authorityLevel: 'binding', title: 'Storygate SIPOC/FIPOC Process Constitution', path: 'docs/SIPOC_STORYGATE_PROCESS.md', appliesToStageIds: STORYGATE_PROCESS_REGISTRY.map((stage) => stage.stageId), appliesToArtifacts: STORYGATE_ARTIFACT_REGISTRY.map((artifact) => artifact.artifact), executionUse: 'Human/machine process constitution and counterpart to this registry.', notes: 'Changes to Storygate registry must be reflected in this document and CSV mirrors.' },
  { authorityId: 'SYSTEM_FACTORY_MAP', family: 'governance', authorityLevel: 'secondary', title: 'RevisionGrade System Factory Map', path: 'docs/SYSTEM_FACTORY_MAP.md', appliesToStageIds: STORYGATE_PROCESS_REGISTRY.map((stage) => stage.stageId), appliesToArtifacts: ['agent_readiness_package_v1', 'storygate_eligibility_result_v1'], executionUse: 'Executive cross-factory map showing Storygate as registry-described, partial, and not SIPOC-enforced.', notes: 'Factory map summarizes; canon and registry govern details.' },
  { authorityId: 'STORYGATE_APP_ROUTES', family: 'runtime', authorityLevel: 'runtime_reference', title: 'Current Storygate Studio Routes', path: 'app/storygate-studio/page.tsx', appliesToStageIds: ['SG01_CREATOR_SUBMISSION', 'SG05_PACKAGE_VERIFICATION', 'SG06_READINESS_VERIFICATION', 'SG07_INDUSTRY_VERIFICATION'], appliesToArtifacts: ['agent_readiness_package_v1', 'storygate_eligibility_result_v1', 'industry_verification_request_v1'], executionUse: 'Current public copy and route references for creator preparation, FAQ, and industry verification shells.', notes: 'Runtime reference only; docs/storygate/STORYGATE_STUDIO_CANON.md remains primary authority.' },
  { authorityId: 'BASE44_STORYGATE_FLOW_MAP_LEGACY', family: 'legacy', authorityLevel: 'legacy_reference_only', title: 'Legacy Base44 Storygate Flow Map', path: 'base44/functions/STORYGATE_FLOW_MAP.md/entry.ts', appliesToStageIds: [], appliesToArtifacts: [], executionUse: 'Historical context only. Must not be used as binding authority for current Storygate Studio governance.', notes: 'Legacy material may contain obsolete threshold/scope assumptions.' },
  { authorityId: 'BASE44_STORYGATE_FUNCTIONS_LEGACY', family: 'legacy', authorityLevel: 'legacy_reference_only', title: 'Legacy Base44 Storygate Functions', path: 'base44/functions/screenStorygateSubmission/entry.ts', appliesToStageIds: [], appliesToArtifacts: [], executionUse: 'Historical implementation context only. Must not certify current Storygate Studio behavior.', notes: 'Base44 function names and film/screen-adjacent assumptions are not current canon.' },
] as const;

export interface StorygateRendererEntry {
  surface: string;
  route: string;
  consumedArtifacts: string[];
  consumedFields: string[];
  writeCapability: boolean;
  notes: string;
}

export const STORYGATE_RENDERER_MATRIX: readonly StorygateRendererEntry[] = [
  { surface: 'StorygateStudioLanding', route: '/storygate-studio', consumedArtifacts: ['agent_readiness_package_v1', 'storygate_eligibility_result_v1'], consumedFields: ['market_comparables', 'market_category', 'target_audience', 'market_position_statement', 'readinessThreshold', 'eligible'], writeCapability: false, notes: 'Public overview. Must state 9.0 threshold and manuscript-first/publishing-only scope.' },
  { surface: 'StorygateApplyPage', route: '/storygate-studio/apply', consumedArtifacts: ['agent_readiness_package_v1', 'storygate_submission_request_v1'], consumedFields: ['query_letter', 'synopsis', 'author_bio', 'market_comparables', 'market_category', 'target_audience', 'market_position_statement', 'rights_declaration', 'readinessThreshold'], writeCapability: false, notes: 'Creator preparation page. Current Next.js route does not create submission records.' },
  { surface: 'StorygateFaqPage', route: '/storygate-studio/faq', consumedArtifacts: ['agent_readiness_package_v1', 'storygate_eligibility_result_v1'], consumedFields: ['market_comparables', 'market_category', 'target_audience', 'market_position_statement', 'readinessThreshold', 'verification_state'], writeCapability: false, notes: 'Public FAQ describing controlled access, manuscript-first scope, required comparables, market category, market positioning, and no-guarantee boundary.' },
  { surface: 'IndustryAccessPage', route: '/storygate-studio/industry', consumedArtifacts: ['industry_verification_request_v1'], consumedFields: ['verification_state'], writeCapability: false, notes: 'Publishing-professional sign-in/request shell.' },
  { surface: 'IndustryDashboardShell', route: '/storygate-studio/industry/dashboard', consumedArtifacts: ['industry_verification_record_v1', 'project_listing_v1'], consumedFields: ['verification_state', 'visibility'], writeCapability: false, notes: 'Shell page; not the concrete access-control implementation.' },
] as const;

export interface StorygateCertificationGateEntry {
  gateId: string;
  description: string;
  appliesToStageId: string;
  enforced: boolean;
  testEvidence: string;
  notes: string;
}

export const STORYGATE_CERTIFICATION_GATE_REGISTRY: readonly StorygateCertificationGateEntry[] = [
  { gateId: 'SGCG01_CURRENT_CANON_EXISTS', description: 'Current Storygate Studio canon must exist and supersede legacy Base44 materials.', appliesToStageId: 'SG01_CREATOR_SUBMISSION', enforced: true, testEvidence: 'docs/storygate/STORYGATE_STUDIO_CANON.md', notes: 'Primary binding Storygate authority.' },
  { gateId: 'SGCG02_REQUIRED_PACKAGE', description: 'Package requires query letter, synopsis, author bio, elevator pitch, agent pitch, market comparables, market category, target audience, market position statement, sample pages, and rights declaration.', appliesToStageId: 'SG05_PACKAGE_VERIFICATION', enforced: true, testEvidence: '__tests__/lib/storygate/storygateSubmissionValidator.test.ts', notes: 'Validator enforces required package fields and blocks placeholders before eligibility.' },
  { gateId: 'SGCG03_THRESHOLD_NINE', description: 'Storygate Studio admission threshold is 9.0/10.', appliesToStageId: 'SG06_READINESS_VERIFICATION', enforced: true, testEvidence: '__tests__/lib/storygate/storygateRegistry.test.ts', notes: 'No 8.0 Storygate admission contract is permitted.' },
  { gateId: 'SGCG04_NO_FILM_SCOPE', description: 'Current Storygate Studio governance excludes film/screen/adaptation/deck/treatment/producer-facing requirements.', appliesToStageId: 'SG02_INTAKE_VALIDATION', enforced: true, testEvidence: '__tests__/lib/storygate/storygateRegistry.test.ts', notes: 'A manuscript may have adaptation potential later, but this is not current Storygate governance.' },
  { gateId: 'SGCG05_BASE_FORTY_FOUR_LEGACY_ONLY', description: 'Base44 Storygate materials, if referenced, must be legacy_reference_only and non-binding.', appliesToStageId: 'SG01_CREATOR_SUBMISSION', enforced: true, testEvidence: '__tests__/lib/storygate/storygateRegistry.test.ts', notes: 'Prevents GitHub/Copilot from treating Base44 as current authority.' },
  { gateId: 'SGCG06_VERIFIED_INDUSTRY_ONLY', description: 'Only verified publishing professionals/admins may see full listings or request project access.', appliesToStageId: 'SG07_INDUSTRY_VERIFICATION', enforced: false, testEvidence: 'app/storygate-studio/industry/page.tsx', notes: 'Verification route is a shell; server enforcement remains missing-critical.' },
  { gateId: 'SGCG07_CREATOR_APPROVAL_REQUIRED', description: 'Industry access requires creator/admin approval and no automatic access on request.', appliesToStageId: 'SG10_CREATOR_ADMIN_APPROVAL', enforced: false, testEvidence: 'docs/SIPOC_STORYGATE_PROCESS.md', notes: 'Concrete route/function not present in this repo snapshot.' },
  { gateId: 'SGCG08_STRUCTURED_AUDIT_REQUIRED', description: 'All state-changing and access actions require structured append-only audit events.', appliesToStageId: 'SG12_ACCESS_LOGGING_REVOCATION', enforced: false, testEvidence: 'docs/SIPOC_STORYGATE_PROCESS.md', notes: 'Structured audit/SLA fields remain missing-critical.' },
] as const;

export interface StorygateThresholdEntry {
  thresholdId: string;
  canonicalValue: number;
  implementationValue: number;
  appliesToStageIds: string[];
  fitGapStatus: StorygateFitGapStatus;
  notes: string;
}

export const STORYGATE_THRESHOLD_REGISTRY: readonly StorygateThresholdEntry[] = [
  {
    thresholdId: 'STORYGATE_STUDIO_ADMISSION_FLOOR',
    canonicalValue: STORYGATE_ADMISSION_THRESHOLD,
    implementationValue: STORYGATE_ADMISSION_THRESHOLD,
    appliesToStageIds: ['SG03_INTERNAL_SCREENING', 'SG06_READINESS_VERIFICATION'],
    fitGapStatus: 'gap',
    notes: 'Storygate Studio admission threshold is 9.0/10. RevisionGrade readiness and Storygate admission are separate gates; Base44 material is legacy-only and must not reset this value to 8.0.',
  },
] as const;
