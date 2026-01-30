/**
 * Phase A.1: Error Envelope Tests
 * 
 * Validates structured error handling for evaluation jobs
 */

import { describe, it, expect } from '@jest/globals';
import {
  toErrorEnvelope,
  isRetryable,
  classifyError,
  ERROR_CODES,
  type ErrorEnvelopeV1,
} from '../lib/errors/errorEnvelope';

describe('Error Envelope (Phase A.1)', () => {
  describe('classifyError', () => {
    it('classifies OpenAI rate limit as retryable', () => {
      const error = { status: 429, message: 'Rate limit exceeded' };
      const { code, retryable } = classifyError(error);
      
      expect(code).toBe('RATE_LIMIT');
      expect(retryable).toBe(true);
    });

    it('classifies timeout as retryable', () => {
      const error = { code: 'ETIMEDOUT' };
      const { code, retryable } = classifyError(error);
      
      expect(code).toBe('TIMEOUT');
      expect(retryable).toBe(true);
    });

    it('classifies network error as retryable', () => {
      const error = { code: 'ECONNREFUSED' };
      const { code, retryable } = classifyError(error);
      
      expect(code).toBe('NETWORK_ERROR');
      expect(retryable).toBe(true);
    });

    it('classifies 5xx server error as retryable', () => {
      const error = { status: 503, message: 'Service unavailable' };
      const { code, retryable } = classifyError(error);
      
      expect(code).toBe('SERVER_ERROR'); // 503 is caught by 5xx check first
      expect(retryable).toBe(true);
    });

    it('classifies auth failure as non-retryable', () => {
      const error = { status: 401, message: 'Unauthorized' };
      const { code, retryable } = classifyError(error);
      
      expect(code).toBe('AUTH_FAILED');
      expect(retryable).toBe(false);
    });

    it('classifies invalid input as non-retryable', () => {
      const error = { status: 400, message: 'Invalid request' };
      const { code, retryable } = classifyError(error);
      
      expect(code).toBe('INVALID_INPUT');
      expect(retryable).toBe(false);
    });

    it('classifies quota exceeded as non-retryable', () => {
      const error = { code: 'insufficient_quota' };
      const { code, retryable } = classifyError(error);
      
      expect(code).toBe('QUOTA_EXCEEDED');
      expect(retryable).toBe(false);
    });

    it('classifies unknown error as non-retryable by default', () => {
      const error = new Error('Something went wrong');
      const { code, retryable } = classifyError(error);
      
      expect(code).toBe('UNKNOWN_ERROR');
      expect(retryable).toBe(false);
    });
  });

  describe('toErrorEnvelope', () => {
    it('creates envelope with all required fields', () => {
      const error = { status: 429, message: 'Rate limit' };
      const envelope = toErrorEnvelope(error, {
        phase: 'phase_2',
        jobId: 'job-123',
        manuscriptId: 456,
        provider: 'openai',
      });

      expect(envelope).toMatchObject({
        code: 'RATE_LIMIT',
        retryable: true,
        phase: 'phase_2',
        provider: 'openai',
      });
      expect(envelope.message).toContain('rate limit');
      expect(envelope.occurred_at).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601
      expect(envelope.context?.jobId).toBe('job-123');
      expect(envelope.context?.manuscriptId).toBe(456);
    });

    it('includes error message from Error instance', () => {
      const error = new Error('Connection failed');
      const envelope = toErrorEnvelope(error, {
        phase: 'phase_1',
        jobId: 'job-789',
      });

      expect(envelope.message).toContain('Connection failed');
    });

    it('truncates long messages to 500 chars', () => {
      const longMessage = 'x'.repeat(1000);
      const error = new Error(longMessage);
      const envelope = toErrorEnvelope(error, {
        phase: 'phase_2',
      });

      expect(envelope.message.length).toBeLessThanOrEqual(500);
      expect(envelope.message).toMatch(/\.\.\.$/);
    });

    it('includes additional context fields', () => {
      const envelope = toErrorEnvelope(new Error('test'), {
        phase: 'phase_2',
        jobId: 'job-1',
        chunkIndex: 5,
        customField: 'custom-value',
      });

      expect(envelope.context).toMatchObject({
        jobId: 'job-1',
        chunkIndex: 5,
        customField: 'custom-value',
      });
    });
  });

  describe('isRetryable helper', () => {
    it('returns true for retryable errors', () => {
      const error = { status: 429 };
      expect(isRetryable(error)).toBe(true);
    });

    it('returns false for non-retryable errors', () => {
      const error = { status: 400 };
      expect(isRetryable(error)).toBe(false);
    });
  });

  describe('ERROR_CODES constant', () => {
    it('has consistent retryability classification', () => {
      expect(ERROR_CODES.RATE_LIMIT.retryable).toBe(true);
      expect(ERROR_CODES.TIMEOUT.retryable).toBe(true);
      expect(ERROR_CODES.NETWORK_ERROR.retryable).toBe(true);
      expect(ERROR_CODES.SERVER_ERROR.retryable).toBe(true);
      
      expect(ERROR_CODES.INVALID_INPUT.retryable).toBe(false);
      expect(ERROR_CODES.AUTH_FAILED.retryable).toBe(false);
      expect(ERROR_CODES.QUOTA_EXCEEDED.retryable).toBe(false);
      expect(ERROR_CODES.UNKNOWN_ERROR.retryable).toBe(false);
    });

    it('has human-readable messages', () => {
      expect(ERROR_CODES.RATE_LIMIT.message).toBeTruthy();
      expect(ERROR_CODES.TIMEOUT.message).toBeTruthy();
      expect(ERROR_CODES.MANUSCRIPT_NOT_FOUND.message).toBeTruthy();
    });
  });
});
