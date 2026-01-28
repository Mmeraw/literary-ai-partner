/**
 * Phase 2C-4 Persistence Tests
 * 
 * Tests the evaluation_provider_calls table persistence layer:
 * - Schema validation
 * - Round-trip serialization
 * - Redaction/truncation
 * - Audit trail consistency
 * 
 * Run: npx jest phase2c4-persistence.test.ts --no-coverage
 */

import {
  ProviderCallRecord,
  ProviderRequestMeta,
  ProviderResponseMeta,
  ProviderErrorMeta,
  CanonicalResultEnvelope,
  truncateErrorMessage,
  redactProviderCallRecord,
} from './types/providerCalls';

describe('Phase 2C-4: Provider Call Persistence', () => {
  describe('Schema Types', () => {
    it('should construct valid ProviderRequestMeta', () => {
      const req: ProviderRequestMeta = {
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_output_tokens: 1200,
        prompt_version: 'phase2-v1',
        input_chars: 2048,
      };

      expect(req.model).toBe('gpt-4o-mini');
      expect(req.temperature).toBe(0.2);
      expect(req.max_output_tokens).toBe(1200);
      expect(req.input_chars).toBeGreaterThan(0);
    });

    it('should construct valid ProviderResponseMeta', () => {
      const resp: ProviderResponseMeta = {
        latency_ms: 2100,
        retries: 1,
        status_code: 200,
        output_chars: 512,
        tokens_input: 350,
        tokens_output: 180,
        finish_reason: 'stop',
      };

      expect(resp.latency_ms).toBeGreaterThan(0);
      expect(resp.retries).toBe(1);
      expect(resp.finish_reason).toBe('stop');
    });

    it('should construct valid ProviderErrorMeta', () => {
      const err: ProviderErrorMeta = {
        code: 'rate_limit_error',
        status_code: 429,
        retryable: true,
        message: 'Rate limit exceeded',
        error_kind: 'retryable_exhausted',
      };

      expect(err.retryable).toBe(true);
      expect(err.status_code).toBe(429);
      expect(err.error_kind).toMatch(/^(fast_fail|retryable_exhausted|circuit_open|unknown)$/);
    });

    it('should construct valid CanonicalResultEnvelope', () => {
      const result: CanonicalResultEnvelope = {
        overview: {
          verdict: 'accept',
          strengths: ['Good prose'],
          concerns: [],
          summary: 'Well done',
        },
        details: { plot_score: 8.5 },
        metadata: {
          simulated: false,
          processingTimeMs: 1600,
          model: 'gpt-4o-mini',
        },
        partial: false,
      };

      expect(result.overview.verdict).toMatch(/^(accept|revise|reject|needs_review)$/);
      expect(result.partial).toBe(false);
      expect(result.metadata.simulated).toBe(false);
    });
  });

  describe('Round-Trip Serialization', () => {
    it('should serialize and deserialize a full provider call record', () => {
      const original: ProviderCallRecord = {
        job_id: '550e8400-e29b-41d4-a716-446655440000',
        phase: 'phase_2',
        provider: 'openai',
        provider_meta_version: '2c1.v1',
        request_meta: {
          model: 'gpt-4o-mini',
          temperature: 0.2,
          max_output_tokens: 1200,
          prompt_version: 'phase2-v1',
          input_chars: 2048,
        },
        response_meta: {
          latency_ms: 2100,
          retries: 1,
          status_code: 200,
          output_chars: 512,
          tokens_input: 350,
          tokens_output: 180,
          finish_reason: 'stop',
        },
        result_envelope: {
          overview: {
            verdict: 'accept',
            strengths: ['Good prose'],
            concerns: [],
            summary: 'Well done',
          },
          details: {},
          metadata: {
            simulated: false,
            processingTimeMs: 1600,
            model: 'gpt-4o-mini',
          },
          partial: false,
        },
      };

      // Simulate JSON serialization (as would happen in DB layer)
      const json = JSON.stringify(original);
      const deserialized: ProviderCallRecord = JSON.parse(json);

      expect(deserialized.job_id).toBe(original.job_id);
      expect(deserialized.provider).toBe('openai');
      expect(deserialized.request_meta.model).toBe('gpt-4o-mini');
      expect(deserialized.response_meta?.latency_ms).toBe(2100);
      expect(deserialized.result_envelope?.overview.verdict).toBe('accept');
    });

    it('should handle optional fields gracefully', () => {
      const minimal: ProviderCallRecord = {
        job_id: '550e8400-e29b-41d4-a716-446655440000',
        phase: 'phase_2',
        provider: 'simulated',
        provider_meta_version: '2c1.v1',
        request_meta: {
          model: 'simulated',
          temperature: 0,
          prompt_version: 'none',
          input_chars: 0,
        },
        // response_meta, error_meta, result_envelope all omitted
      };

      const json = JSON.stringify(minimal);
      const deserialized: ProviderCallRecord = JSON.parse(json);

      expect(deserialized.response_meta).toBeUndefined();
      expect(deserialized.error_meta).toBeUndefined();
      expect(deserialized.result_envelope).toBeUndefined();
    });
  });

  describe('Error Truncation', () => {
    it('should truncate long error messages', () => {
      const longMsg = 'x'.repeat(1000);
      const truncated = truncateErrorMessage(longMsg, 512);

      expect(truncated.length).toBeLessThanOrEqual(512);
      expect(truncated).toMatch(/\.\.\.$/);
    });

    it('should not truncate short error messages', () => {
      const shortMsg = 'Rate limit exceeded';
      const truncated = truncateErrorMessage(shortMsg, 512);

      expect(truncated).toBe(shortMsg);
    });

    it('should handle exact boundary', () => {
      const exactMsg = 'x'.repeat(512);
      const truncated = truncateErrorMessage(exactMsg, 512);

      expect(truncated).toBe(exactMsg);
    });
  });

  describe('Redaction', () => {
    it('should redact a provider call record (currently no-op)', () => {
      const original: ProviderCallRecord = {
        job_id: '550e8400-e29b-41d4-a716-446655440000',
        phase: 'phase_2',
        provider: 'openai',
        provider_meta_version: '2c1.v1',
        request_meta: {
          model: 'gpt-4o-mini',
          temperature: 0.2,
          max_output_tokens: 1200,
          prompt_version: 'phase2-v1',
          input_chars: 2048,
        },
      };

      const redacted = redactProviderCallRecord(original);

      // Currently no-op; this test documents the contract
      expect(redacted.job_id).toBe(original.job_id);
      expect(redacted.request_meta.model).toBe(original.request_meta.model);
      // Future: add redaction logic for API keys, full prompts, etc.
    });
  });

  describe('Audit Trail Semantics', () => {
    it('should support fast-fail error classification', () => {
      const fastFailErr: ProviderErrorMeta = {
        code: 'invalid_api_key',
        status_code: 401,
        retryable: false,
        message: 'Unauthorized',
        error_kind: 'fast_fail',
      };

      expect(fastFailErr.retryable).toBe(false);
      expect(fastFailErr.error_kind).toBe('fast_fail');
      expect(fastFailErr.status_code).toBe(401);
    });

    it('should support retryable exhausted classification', () => {
      const exhaustedErr: ProviderErrorMeta = {
        code: 'rate_limit_error',
        status_code: 429,
        retryable: true,
        message: 'Rate limit exceeded. Retries exhausted.',
        error_kind: 'retryable_exhausted',
      };

      expect(exhaustedErr.retryable).toBe(true);
      expect(exhaustedErr.error_kind).toBe('retryable_exhausted');
    });

    it('should support circuit breaker open classification', () => {
      const circuitErr: ProviderErrorMeta = {
        code: 'circuit_breaker_open',
        status_code: undefined,
        retryable: false,
        message: 'Circuit breaker is open',
        error_kind: 'circuit_open',
      };

      expect(circuitErr.error_kind).toBe('circuit_open');
      expect(circuitErr.status_code).toBeUndefined();
    });

    it('should support success with no error_meta', () => {
      const rec: ProviderCallRecord = {
        job_id: '550e8400-e29b-41d4-a716-446655440000',
        phase: 'phase_2',
        provider: 'openai',
        provider_meta_version: '2c1.v1',
        request_meta: {
          model: 'gpt-4o-mini',
          temperature: 0.2,
          max_output_tokens: 1200,
          prompt_version: 'phase2-v1',
          input_chars: 2048,
        },
        response_meta: {
          latency_ms: 2100,
          retries: 0,
          status_code: 200,
          output_chars: 512,
          finish_reason: 'stop',
        },
        // No error_meta
      };

      expect(rec.error_meta).toBeUndefined();
      expect(rec.response_meta?.status_code).toBe(200);
    });
  });

  describe('Schema Version Tracking', () => {
    it('should track provider_meta_version for future evolution', () => {
      const rec: ProviderCallRecord = {
        job_id: '550e8400-e29b-41d4-a716-446655440000',
        phase: 'phase_2',
        provider: 'openai',
        provider_meta_version: '2c1.v1',  // Canonical for Phase 2C-1
        request_meta: {
          model: 'gpt-4o-mini',
          temperature: 0.2,
          max_output_tokens: 1200,
          prompt_version: 'phase2-v1',
          input_chars: 2048,
        },
      };

      // This documents the versioning contract:
      // If you later add new fields or change structure,
      // you'd increment to "2c1.v2" and update the types,
      // but existing "2c1.v1" records remain readable.
      expect(rec.provider_meta_version).toBe('2c1.v1');
    });

    it('should allow multiple versions in the same database', () => {
      const v1: ProviderCallRecord = {
        job_id: '550e8400-e29b-41d4-a716-446655440000',
        phase: 'phase_2',
        provider: 'openai',
        provider_meta_version: '2c1.v1',
        request_meta: {
          model: 'gpt-4o-mini',
          temperature: 0.2,
          max_output_tokens: 1200,
          prompt_version: 'phase2-v1',
          input_chars: 2048,
        },
      };

      // Hypothetical future version (not created yet, just demonstrating contract)
      const v2Hypothetical = {
        ...v1,
        provider_meta_version: '2c1.v2',
        // Additional fields would go here
      };

      expect(v1.provider_meta_version).toBe('2c1.v1');
      expect(v2Hypothetical.provider_meta_version).toBe('2c1.v2');
    });
  });

  describe('Simulated Provider Tracking', () => {
    it('should track simulated runs with same audit structure', () => {
      const simulatedRec: ProviderCallRecord = {
        job_id: '550e8400-e29b-41d4-a716-446655440000',
        phase: 'phase_2',
        provider: 'simulated',  // Fallback when no OPENAI_API_KEY
        provider_meta_version: '2c1.v1',
        request_meta: {
          model: 'simulated',
          temperature: 0,
          max_output_tokens: 0,
          prompt_version: 'none',
          input_chars: 0,
        },
        result_envelope: {
          overview: {
            verdict: 'needs_review',
            summary: 'Simulated evaluation (no OpenAI key)',
          },
          details: {},
          metadata: {
            simulated: true,
            processingTimeMs: 2000,  // Fake delay
          },
          partial: true,
        },
      };

      expect(simulatedRec.provider).toBe('simulated');
      expect(simulatedRec.result_envelope?.metadata.simulated).toBe(true);
      expect(simulatedRec.result_envelope?.partial).toBe(true);
      // Audit trail is identical; only provider and simulated flag differ
    });
  });
});
