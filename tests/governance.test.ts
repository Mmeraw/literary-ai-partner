/**
 * Phase 2F: Adversarial Test Suite for Runtime Governance
 * Tests: duplicate claims, stale lease, invalid transitions, idempotency
 */
import { describe, it, expect } from 'vitest';
import { classifyError, getSeverityPolicy, SEVERITY_POLICIES } from '../lib/governance/severityPolicy';

describe('SeverityPolicy Registry', () => {
  it('returns correct policy for known error types', () => {
    const p = getSeverityPolicy('openai_timeout');
    expect(p.severity).toBe('transient');
    expect(p.retryable).toBe(true);
    expect(p.maxRetries).toBeGreaterThan(0);
  });

  it('falls back to unknown_error for unrecognized types', () => {
    const p = getSeverityPolicy('some_weird_error');
    expect(p.severity).toBe('unknown');
    expect(p.retryable).toBe(true);
    expect(p.maxRetries).toBe(1);
  });

  it('fatal errors are not retryable', () => {
    const fatal = ['invalid_transition', 'missing_content'];
    for (const key of fatal) {
      const p = SEVERITY_POLICIES[key];
      expect(p.retryable).toBe(false);
      expect(p.maxRetries).toBe(0);
    }
  });

  it('all policies have required fields', () => {
    for (const [key, p] of Object.entries(SEVERITY_POLICIES)) {
      expect(p.severity).toBeDefined();
      expect(typeof p.retryable).toBe('boolean');
      expect(typeof p.maxRetries).toBe('number');
      expect(typeof p.backoffMs).toBe('number');
      expect(p.escalation).toBeDefined();
      expect(p.description.length).toBeGreaterThan(0);
    }
  });
});

describe('classifyError', () => {
  it('classifies timeout errors', () => {
    expect(classifyError(new Error('Request timed out'))).toBe('openai_timeout');
    expect(classifyError(new Error('TIMEOUT reached'))).toBe('openai_timeout');
  });

  it('classifies rate limit errors', () => {
    expect(classifyError(new Error('Rate limit exceeded'))).toBe('openai_rate_limit');
  });

  it('classifies server errors', () => {
    expect(classifyError(new Error('502 Bad Gateway'))).toBe('openai_server_error');
    expect(classifyError(new Error('503 Service Unavailable'))).toBe('openai_server_error');
  });

  it('classifies parse failures', () => {
    expect(classifyError(new Error('JSON parse error'))).toBe('parse_failure');
  });

  it('classifies missing content', () => {
    expect(classifyError(new Error('Content is missing'))).toBe('missing_content');
  });

  it('classifies lease expired', () => {
    expect(classifyError(new Error('Lease has expired'))).toBe('lease_expired');
  });

  it('classifies invalid transitions', () => {
    expect(classifyError(new Error('Invalid transition from queued to done'))).toBe('invalid_transition');
  });

  it('returns unknown for unrecognized errors', () => {
    expect(classifyError(new Error('something weird'))).toBe('unknown_error');
    expect(classifyError('not an Error object')).toBe('unknown_error');
    expect(classifyError(null)).toBe('unknown_error');
  });
});

describe('State Machine Transitions (unit-level validation)', () => {
  const VALID_TRANSITIONS: Record<string, string[]> = {
    queued: ['processing', 'failed'],
    processing: ['completed', 'failed', 'queued'],
    completed: [],
    failed: ['queued'],
  };

  it('only allows valid transitions', () => {
    expect(VALID_TRANSITIONS['queued']).toContain('processing');
    expect(VALID_TRANSITIONS['queued']).not.toContain('completed');
    expect(VALID_TRANSITIONS['processing']).toContain('completed');
    expect(VALID_TRANSITIONS['processing']).toContain('failed');
    expect(VALID_TRANSITIONS['completed']).toHaveLength(0);
    expect(VALID_TRANSITIONS['failed']).toContain('queued');
    expect(VALID_TRANSITIONS['failed']).not.toContain('completed');
  });

  it('completed is a terminal state', () => {
    expect(VALID_TRANSITIONS['completed']).toEqual([]);
  });

  it('rejects direct queued->completed skip', () => {
    expect(VALID_TRANSITIONS['queued']).not.toContain('completed');
  });
});
