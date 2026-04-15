/**
 * Phase 2E: Severity Policy Registry
 * Maps error classifications to retry/escalation behavior.
 */

export interface SeverityPolicy {
  severity: 'transient' | 'degraded' | 'fatal' | 'unknown';
  retryable: boolean;
  maxRetries: number;
  backoffMs: number;
  escalation: 'retry' | 'quarantine' | 'alert_and_quarantine';
  description: string;
}

export const SEVERITY_POLICIES: Record<string, SeverityPolicy> = {
  openai_timeout: {
    severity: 'transient',
    retryable: true,
    maxRetries: 3,
    backoffMs: 5000,
    escalation: 'retry',
    description: 'OpenAI API timeout — safe to retry with backoff',
  },
  openai_rate_limit: {
    severity: 'transient',
    retryable: true,
    maxRetries: 5,
    backoffMs: 15000,
    escalation: 'retry',
    description: 'Rate limit hit — retry with longer backoff',
  },
  openai_server_error: {
    severity: 'transient',
    retryable: true,
    maxRetries: 2,
    backoffMs: 10000,
    escalation: 'retry',
    description: 'OpenAI 5xx — retry with backoff',
  },
  parse_failure: {
    severity: 'degraded',
    retryable: true,
    maxRetries: 1,
    backoffMs: 2000,
    escalation: 'quarantine',
    description: 'Response parse failed — one retry then quarantine',
  },
  invalid_transition: {
    severity: 'fatal',
    retryable: false,
    maxRetries: 0,
    backoffMs: 0,
    escalation: 'alert_and_quarantine',
    description: 'State machine violation — quarantine immediately',
  },
  missing_content: {
    severity: 'fatal',
    retryable: false,
    maxRetries: 0,
    backoffMs: 0,
    escalation: 'alert_and_quarantine',
    description: 'No manuscript content — cannot proceed',
  },
  lease_expired: {
    severity: 'degraded',
    retryable: true,
    maxRetries: 1,
    backoffMs: 0,
    escalation: 'quarantine',
    description: 'Lease expired mid-processing — requeue once',
  },
  unknown_error: {
    severity: 'unknown',
    retryable: true,
    maxRetries: 1,
    backoffMs: 5000,
    escalation: 'quarantine',
    description: 'Unclassified error — one retry then quarantine',
  },
};

export function getSeverityPolicy(errorType: string): SeverityPolicy {
  return SEVERITY_POLICIES[errorType] ?? SEVERITY_POLICIES['unknown_error'];
}

export function classifyError(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('timeout') || msg.includes('timed out')) return 'openai_timeout';
    if (msg.includes('rate') && msg.includes('limit')) return 'openai_rate_limit';
    if (msg.includes('500') || msg.includes('502') || msg.includes('503')) return 'openai_server_error';
    if (msg.includes('parse') || msg.includes('json')) return 'parse_failure';
    if (msg.includes('content') && msg.includes('missing')) return 'missing_content';
    if (msg.includes('lease') && msg.includes('expired')) return 'lease_expired';
    if (msg.includes('invalid transition')) return 'invalid_transition';
  }
  return 'unknown_error';
}
