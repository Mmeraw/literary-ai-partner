import { REVISION_OPERATIONS } from './reviseCardContract';
import { SLAE_GROUNDING_STATUSES } from './slae';

export const REVISION_OPPORTUNITY_LEDGER_CONTRACT_VERSION = 'revision_opportunity_ledger_v1' as const;

export type RevisionOpportunityLedgerContractIssueCode =
  | 'LEDGER_NOT_OBJECT'
  | 'LEDGER_FIELD_MISSING'
  | 'LEDGER_FIELD_INVALID'
  | 'OPPORTUNITIES_NOT_ARRAY'
  | 'OPPORTUNITY_NOT_OBJECT'
  | 'OPPORTUNITY_FIELD_MISSING'
  | 'OPPORTUNITY_FIELD_INVALID'
  | 'DUPLICATE_OPPORTUNITY_ID';

export type RevisionOpportunityLedgerContractIssue = {
  code: RevisionOpportunityLedgerContractIssueCode;
  path: string;
  message: string;
};

export type RevisionOpportunityLedgerContractResult = {
  valid: boolean;
  issues: RevisionOpportunityLedgerContractIssue[];
  opportunityCount: number;
};

const SEVERITIES = new Set(['must', 'should', 'could']);
const CONFIDENCE_BANDS = new Set(['low', 'medium', 'high']);
const DECISION_STATES = new Set(['open']);
const PREFLIGHT_STATES = new Set(['passed', 'limited_context', 'blocked']);
const GROUNDING_STATES = new Set<string>(SLAE_GROUNDING_STATUSES);
const REVISION_OPERATION_SET = new Set<string>(REVISION_OPERATIONS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function requireNonEmptyString(
  record: Record<string, unknown>,
  field: string,
  pathPrefix: string,
  issues: RevisionOpportunityLedgerContractIssue[],
  code: 'LEDGER_FIELD_MISSING' | 'OPPORTUNITY_FIELD_MISSING',
): void {
  if (!isNonEmptyString(record[field])) {
    issues.push({
      code,
      path: `${pathPrefix}.${field}`,
      message: `${pathPrefix}.${field} must be a non-empty string.`,
    });
  }
}

function requireRecord(
  record: Record<string, unknown>,
  field: string,
  issues: RevisionOpportunityLedgerContractIssue[],
): void {
  if (!isRecord(record[field])) {
    issues.push({
      code: 'LEDGER_FIELD_MISSING',
      path: `$.${field}`,
      message: `$.${field} must be an object.`,
    });
  }
}

export function validateRevisionOpportunityLedgerPayload(
  value: unknown,
): RevisionOpportunityLedgerContractResult {
  const issues: RevisionOpportunityLedgerContractIssue[] = [];
  if (!isRecord(value)) {
    return {
      valid: false,
      opportunityCount: 0,
      issues: [{ code: 'LEDGER_NOT_OBJECT', path: '$', message: 'Revision opportunity ledger must be an object.' }],
    };
  }

  for (const field of [
    'job_id',
    'manuscript_version_hash',
    'artifact_id',
    'artifact_version',
    'source_hash',
    'generated_at',
    'opportunity_source_authority',
  ]) {
    requireNonEmptyString(value, field, '$', issues, 'LEDGER_FIELD_MISSING');
  }

  if (value.artifact_type !== REVISION_OPPORTUNITY_LEDGER_CONTRACT_VERSION) {
    issues.push({
      code: 'LEDGER_FIELD_INVALID',
      path: '$.artifact_type',
      message: `$.artifact_type must equal ${REVISION_OPPORTUNITY_LEDGER_CONTRACT_VERSION}.`,
    });
  }
  if (typeof value.manuscript_id !== 'number' || !Number.isFinite(value.manuscript_id) || value.manuscript_id <= 0) {
    issues.push({
      code: 'LEDGER_FIELD_INVALID',
      path: '$.manuscript_id',
      message: '$.manuscript_id must be a positive finite number.',
    });
  }
  requireRecord(value, 'quality_manifest', issues);
  requireRecord(value, 'revise_queue_preflight', issues);

  if (!Array.isArray(value.opportunities)) {
    issues.push({
      code: 'OPPORTUNITIES_NOT_ARRAY',
      path: '$.opportunities',
      message: '$.opportunities must be an array; an empty array is valid governed authority.',
    });
    return { valid: false, issues, opportunityCount: 0 };
  }

  const seenOpportunityIds = new Set<string>();
  value.opportunities.forEach((opportunity, index) => {
    const path = `$.opportunities[${index}]`;
    if (!isRecord(opportunity)) {
      issues.push({ code: 'OPPORTUNITY_NOT_OBJECT', path, message: `${path} must be an object.` });
      return;
    }

    for (const field of [
      'opportunity_id',
      'finding_id',
      'criterion',
      'rationale',
      'evidence_anchor',
      'manuscript_coordinates',
      'provenance',
      'revision_operation',
      'preflight_status',
      'grounding_status',
    ]) {
      requireNonEmptyString(opportunity, field, path, issues, 'OPPORTUNITY_FIELD_MISSING');
    }

    const opportunityId = isNonEmptyString(opportunity.opportunity_id)
      ? opportunity.opportunity_id.trim()
      : null;
    if (opportunityId) {
      if (seenOpportunityIds.has(opportunityId)) {
        issues.push({
          code: 'DUPLICATE_OPPORTUNITY_ID',
          path: `${path}.opportunity_id`,
          message: `Duplicate opportunity_id ${opportunityId}.`,
        });
      }
      seenOpportunityIds.add(opportunityId);
    }

    const enumChecks: Array<[string, Set<string>]> = [
      ['severity', SEVERITIES],
      ['confidence', CONFIDENCE_BANDS],
      ['decision_state', DECISION_STATES],
      ['revision_operation', REVISION_OPERATION_SET],
      ['preflight_status', PREFLIGHT_STATES],
      ['grounding_status', GROUNDING_STATES],
    ];
    for (const [field, allowed] of enumChecks) {
      if (!isNonEmptyString(opportunity[field]) || !allowed.has(opportunity[field])) {
        issues.push({
          code: 'OPPORTUNITY_FIELD_INVALID',
          path: `${path}.${field}`,
          message: `${path}.${field} is not a recognized contract value.`,
        });
      }
    }
  });

  return {
    valid: issues.length === 0,
    issues,
    opportunityCount: value.opportunities.length,
  };
}

export function assertRevisionOpportunityLedgerPayload(value: unknown): void {
  const result = validateRevisionOpportunityLedgerPayload(value);
  if (result.valid) return;
  const summary = result.issues.map((issue) => `${issue.code}:${issue.path}`).join(', ');
  throw new Error(`revision_opportunity_ledger_v1 contract rejected dirty payload (${summary})`);
}
