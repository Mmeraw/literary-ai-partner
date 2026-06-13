import {
  STORYGATE_ADMISSION_THRESHOLD,
  STORYGATE_FORBIDDEN_SCOPE_TERMS,
  STORYGATE_REQUIRED_PACKAGE_FIELDS,
} from '@/lib/storygate/storygateRegistry';
import {
  evaluateCreatorApprovalGate,
  type CreatorApprovalV1,
} from '@/lib/agent-readiness/creatorApprovalGate';

export type StorygateRequiredPackageField = typeof STORYGATE_REQUIRED_PACKAGE_FIELDS[number];

export type StorygateSubmissionValidatorInput = {
  packageFields: Partial<Record<StorygateRequiredPackageField, unknown>>;
  creatorApproval?: CreatorApprovalV1 | null;
  readinessScore?: number | null;
  qualifiedProfessionalEquivalent?: boolean;
  requestedScopeText?: string | null;
  createdAt?: string;
};

export type StorygateSubmissionValidationFailureCode =
  | 'MISSING_REQUIRED_FIELDS'
  | 'PLACEHOLDER_TEXT_DETECTED'
  | 'FORBIDDEN_SCOPE_REQUESTED'
  | 'RIGHTS_DECLARATION_MISSING'
  | 'SCORE_BELOW_THRESHOLD'
  | 'CREATOR_APPROVAL_REQUIRED';

export type StorygateSubmissionValidationResultV1 = {
  artifact_type: 'intake_validation_result_v1';
  artifact_version: 'storygate_submission_validator_v1';
  validator_id: 'storygate_submission_validator_v1';
  valid: boolean;
  eligible: boolean;
  packageGatePass: boolean;
  creatorApprovalGatePass: boolean;
  readinessGatePass: boolean;
  rightsGatePass: boolean;
  readinessThreshold: typeof STORYGATE_ADMISSION_THRESHOLD;
  failureCodes: StorygateSubmissionValidationFailureCode[];
  missingFields: StorygateRequiredPackageField[];
  placeholderFields: StorygateRequiredPackageField[];
  forbiddenScopeTerms: string[];
  created_at: string;
};

const PLACEHOLDER_RE = /\b(tbd|todo|placeholder|lorem ipsum|coming soon|n\/a|none yet|to be written)\b/i;

function hasUsableValue(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(hasUsableValue);
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return false;
}

function containsPlaceholder(value: unknown): boolean {
  if (typeof value === 'string') return PLACEHOLDER_RE.test(value.trim());
  if (Array.isArray(value)) return value.some(containsPlaceholder);
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).some(containsPlaceholder);
  return false;
}

function flattenText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(flattenText).join(' ');
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).map(flattenText).join(' ');
  return '';
}

function normalizeRights(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function validateStorygateSubmission(
  input: StorygateSubmissionValidatorInput,
): StorygateSubmissionValidationResultV1 {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const packageFields = input.packageFields ?? {};

  const missingFields = STORYGATE_REQUIRED_PACKAGE_FIELDS
    .filter((field) => !hasUsableValue(packageFields[field]));

  const placeholderFields = STORYGATE_REQUIRED_PACKAGE_FIELDS
    .filter((field) => hasUsableValue(packageFields[field]) && containsPlaceholder(packageFields[field]));

  const scopeHaystack = [
    input.requestedScopeText ?? '',
    ...STORYGATE_REQUIRED_PACKAGE_FIELDS.map((field) => flattenText(packageFields[field])),
  ].join(' ').toLowerCase();
  const forbiddenScopeTerms = STORYGATE_FORBIDDEN_SCOPE_TERMS
    .filter((term) => scopeHaystack.includes(term.replace(/_/g, ' ').toLowerCase()) || scopeHaystack.includes(term.toLowerCase()))
    .sort();

  const rightsGatePass = normalizeRights(packageFields.rights_declaration) === 'confirmed';
  const creatorApproval = evaluateCreatorApprovalGate({ approval: input.creatorApproval });
  const creatorApprovalGatePass = creatorApproval.ok;
  const packageGatePass = missingFields.length === 0 && placeholderFields.length === 0 && forbiddenScopeTerms.length === 0 && rightsGatePass;
  const readinessScore = typeof input.readinessScore === 'number' && Number.isFinite(input.readinessScore)
    ? input.readinessScore
    : null;
  const readinessGatePass = Boolean(input.qualifiedProfessionalEquivalent) || (readinessScore !== null && readinessScore >= STORYGATE_ADMISSION_THRESHOLD);

  const failureCodes = new Set<StorygateSubmissionValidationFailureCode>();
  if (missingFields.length > 0) failureCodes.add('MISSING_REQUIRED_FIELDS');
  if (placeholderFields.length > 0) failureCodes.add('PLACEHOLDER_TEXT_DETECTED');
  if (forbiddenScopeTerms.length > 0) failureCodes.add('FORBIDDEN_SCOPE_REQUESTED');
  if (!rightsGatePass) failureCodes.add('RIGHTS_DECLARATION_MISSING');
  if (!readinessGatePass) failureCodes.add('SCORE_BELOW_THRESHOLD');
  if (!creatorApprovalGatePass) failureCodes.add('CREATOR_APPROVAL_REQUIRED');

  return {
    artifact_type: 'intake_validation_result_v1',
    artifact_version: 'storygate_submission_validator_v1',
    validator_id: 'storygate_submission_validator_v1',
    valid: failureCodes.size === 0,
    eligible: packageGatePass && readinessGatePass && creatorApprovalGatePass,
    packageGatePass,
    creatorApprovalGatePass,
    readinessGatePass,
    rightsGatePass,
    readinessThreshold: STORYGATE_ADMISSION_THRESHOLD,
    failureCodes: [...failureCodes].sort(),
    missingFields,
    placeholderFields,
    forbiddenScopeTerms,
    created_at: createdAt,
  };
}
