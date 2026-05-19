import {
  resolveEvalEnvContract,
  __resetEvalEnvContract,
} from '../envContract';

const BASE_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
};

const asProcessEnv = (env: Record<string, string | undefined>): NodeJS.ProcessEnv =>
  env as NodeJS.ProcessEnv;

beforeEach(() => {
  __resetEvalEnvContract();
});

describe('resolveEvalEnvContract', () => {
  describe('clean defaults', () => {
    it('returns canonical defaults when no env vars are set', () => {
      const contract = resolveEvalEnvContract(BASE_ENV);
      expect(contract.inputCharBudget).toBe(50_000);
      expect(contract.synthesisRefCharBudget).toBe(400_000);
      expect(contract.openAiModel).toBe('gpt-5.1');
      expect(contract.adjudicationMode).toBe('optional');
      expect(contract.latencyTraceEnabled).toBe(false);
      expect(contract.nodeEnv).toBe('test');
      expect(contract.requiresPerplexityApiKey).toBe(false);
    });

    it('accepts explicit valid values matching defaults', () => {
      const env: NodeJS.ProcessEnv = {
        ...BASE_ENV,
        EVAL_PIPELINE_INPUT_CHAR_BUDGET: '50000',
        EVAL_PIPELINE_SYNTHESIS_REF_CHAR_BUDGET: '8000',
        EVAL_OPENAI_MODEL: 'gpt-4o',
        EVAL_EXTERNAL_ADJUDICATION_MODE: 'optional',
      };
      const contract = resolveEvalEnvContract(env);
      expect(contract.inputCharBudget).toBe(50_000);
      expect(contract.openAiModel).toBe('gpt-4o');
      expect(contract.adjudicationMode).toBe('optional');
    });
  });

  describe('poisoned env values', () => {
    it('throws on non-integer EVAL_PIPELINE_INPUT_CHAR_BUDGET', () => {
      const env = { ...BASE_ENV, EVAL_PIPELINE_INPUT_CHAR_BUDGET: 'abc' };
      expect(() => resolveEvalEnvContract(env)).toThrow('must be a plain integer');
    });

    it('throws on float EVAL_PIPELINE_INPUT_CHAR_BUDGET', () => {
      const env = { ...BASE_ENV, EVAL_PIPELINE_INPUT_CHAR_BUDGET: '40000.5' };
      expect(() => resolveEvalEnvContract(env)).toThrow('must be a plain integer');
    });

    it('throws on partially numeric EVAL_PIPELINE_INPUT_CHAR_BUDGET', () => {
      const env = { ...BASE_ENV, EVAL_PIPELINE_INPUT_CHAR_BUDGET: '60000ms' };
      expect(() => resolveEvalEnvContract(env)).toThrow('must be a plain integer');
    });

    it('throws when EVAL_PIPELINE_INPUT_CHAR_BUDGET is below min (12000)', () => {
      const env = { ...BASE_ENV, EVAL_PIPELINE_INPUT_CHAR_BUDGET: '1000' };
      expect(() => resolveEvalEnvContract(env)).toThrow('must be between');
    });

    it('throws when EVAL_PIPELINE_INPUT_CHAR_BUDGET exceeds max (100000)', () => {
      const env = { ...BASE_ENV, EVAL_PIPELINE_INPUT_CHAR_BUDGET: '200000' };
      expect(() => resolveEvalEnvContract(env)).toThrow('must be between');
    });

    it('throws on non-integer EVAL_PIPELINE_SYNTHESIS_REF_CHAR_BUDGET', () => {
      const env = { ...BASE_ENV, EVAL_PIPELINE_SYNTHESIS_REF_CHAR_BUDGET: 'bad' };
      expect(() => resolveEvalEnvContract(env)).toThrow('must be a plain integer');
    });

    it('throws on invalid EVAL_EXTERNAL_ADJUDICATION_MODE value', () => {
      const env = { ...BASE_ENV, EVAL_EXTERNAL_ADJUDICATION_MODE: 'strict' };
      expect(() => resolveEvalEnvContract(env)).toThrow('must be one of');
    });

    it('throws on empty EVAL_OPENAI_MODEL string (set but blank)', () => {
      const env = { ...BASE_ENV, EVAL_OPENAI_MODEL: '   ' };
      // Blank string falls back to default; non-empty but whitespace-only treated as empty
      // This tests that an explicitly set but empty model uses the default (no throw)
      const contract = resolveEvalEnvContract(env);
      expect(contract.openAiModel).toBe('gpt-5.1');
    });

    it('throws on invalid NODE_ENV value', () => {
      const env = asProcessEnv({ ...BASE_ENV, NODE_ENV: 'staging' });
      expect(() => resolveEvalEnvContract(env)).toThrow('NODE_ENV must be one of');
    });
  });

  describe('empty string overrides (shell export conflict)', () => {
    it('uses default when EVAL_PIPELINE_INPUT_CHAR_BUDGET is empty string', () => {
      const env = { ...BASE_ENV, EVAL_PIPELINE_INPUT_CHAR_BUDGET: '' };
      const contract = resolveEvalEnvContract(env);
      expect(contract.inputCharBudget).toBe(50_000);
    });

    it('uses default when EVAL_PIPELINE_SYNTHESIS_REF_CHAR_BUDGET is empty string', () => {
      const env = { ...BASE_ENV, EVAL_PIPELINE_SYNTHESIS_REF_CHAR_BUDGET: '' };
      const contract = resolveEvalEnvContract(env);
      expect(contract.synthesisRefCharBudget).toBe(400_000);
    });

    it('falls back to gpt-5.1 when EVAL_OPENAI_MODEL is undefined', () => {
      const contract = resolveEvalEnvContract(BASE_ENV);
      expect(contract.openAiModel).toBe('gpt-5.1');
    });
  });

  describe('production o-series guard', () => {
    it('throws in production when EVAL_OPENAI_MODEL is o3 and override is absent', () => {
      const env = asProcessEnv({
        NODE_ENV: 'production',
        EVAL_OPENAI_MODEL: 'o3',
      });

      expect(() => resolveEvalEnvContract(env)).toThrow('reasoning model');
    });

    it('allows production o-series only when EVAL_ALLOW_REASONING_MODELS=true', () => {
      const env = asProcessEnv({
        NODE_ENV: 'production',
        EVAL_OPENAI_MODEL: 'o3',
        EVAL_ALLOW_REASONING_MODELS: 'true',
      });

      const contract = resolveEvalEnvContract(env);
      expect(contract.openAiModel).toBe('o3');
    });
  });

  describe('absent optional vars', () => {
    it('latencyTraceEnabled is false when ENABLE_LATENCY_TRACE_LOGS is absent', () => {
      const contract = resolveEvalEnvContract(BASE_ENV);
      expect(contract.latencyTraceEnabled).toBe(false);
    });

    it('latencyTraceEnabled is false when ENABLE_LATENCY_TRACE_LOGS is "0"', () => {
      const env = { ...BASE_ENV, ENABLE_LATENCY_TRACE_LOGS: '0' };
      const contract = resolveEvalEnvContract(env);
      expect(contract.latencyTraceEnabled).toBe(false);
    });

    it('latencyTraceEnabled is true when ENABLE_LATENCY_TRACE_LOGS is "1"', () => {
      const env = { ...BASE_ENV, ENABLE_LATENCY_TRACE_LOGS: '1' };
      const contract = resolveEvalEnvContract(env);
      expect(contract.latencyTraceEnabled).toBe(true);
    });

    it('adjudicationMode defaults to optional when absent', () => {
      const contract = resolveEvalEnvContract(BASE_ENV);
      expect(contract.adjudicationMode).toBe('optional');
    });

    it('adjudicationMode accepts required', () => {
      const env = { ...BASE_ENV, EVAL_EXTERNAL_ADJUDICATION_MODE: 'required' };
      const contract = resolveEvalEnvContract(env);
      expect(contract.adjudicationMode).toBe('required');
      expect(contract.requiresPerplexityApiKey).toBe(true);
    });

    it('adjudicationMode accepts veto', () => {
      const env = { ...BASE_ENV, EVAL_EXTERNAL_ADJUDICATION_MODE: 'veto' };
      const contract = resolveEvalEnvContract(env);
      expect(contract.adjudicationMode).toBe('veto');
      expect(contract.requiresPerplexityApiKey).toBe(true);
    });

    it('adjudicationMode defaults to required on Vercel production when unset', () => {
      // Premium-product default: two-AI adjudication is the contract in prod.
      // The runtime is expected to fail fast on a missing PERPLEXITY_API_KEY
      // rather than silently skipping Pass 4.
      const env: NodeJS.ProcessEnv = {
        NODE_ENV: 'production',
        VERCEL_ENV: 'production',
      };
      const contract = resolveEvalEnvContract(env);
      expect(contract.adjudicationMode).toBe('required');
      expect(contract.requiresPerplexityApiKey).toBe(true);
    });

    it('adjudicationMode defaults to optional on Vercel preview when unset', () => {
      const env: NodeJS.ProcessEnv = {
        NODE_ENV: 'production',
        VERCEL_ENV: 'preview',
      };
      const contract = resolveEvalEnvContract(env);
      expect(contract.adjudicationMode).toBe('optional');
      expect(contract.requiresPerplexityApiKey).toBe(false);
    });

    it('explicit EVAL_EXTERNAL_ADJUDICATION_MODE overrides the prod default', () => {
      const env: NodeJS.ProcessEnv = {
        NODE_ENV: 'production',
        VERCEL_ENV: 'production',
        EVAL_EXTERNAL_ADJUDICATION_MODE: 'optional',
      };
      const contract = resolveEvalEnvContract(env);
      expect(contract.adjudicationMode).toBe('optional');
      expect(contract.requiresPerplexityApiKey).toBe(false);
    });
  });

  describe('prod-like env', () => {
    it('resolves cleanly with only Vercel platform signals set', () => {
      const env: NodeJS.ProcessEnv = { NODE_ENV: 'production', VERCEL_ENV: 'production' };
      const contract = resolveEvalEnvContract(env);
      expect(contract.nodeEnv).toBe('production');
    });

    it('resolves cleanly on Vercel preview env', () => {
      const env: NodeJS.ProcessEnv = { NODE_ENV: 'production', VERCEL_ENV: 'preview' };
      const contract = resolveEvalEnvContract(env);
      expect(contract.nodeEnv).toBe('production');
    });
  });

  describe('forbidden combinations', () => {
    it('throws when CI=true in Vercel production', () => {
      const env = asProcessEnv({ NODE_ENV: 'production', VERCEL_ENV: 'production', CI: 'true' });
      expect(() => resolveEvalEnvContract(env)).toThrow('CI=true is not permitted in Vercel production');
    });

    it('throws when NODE_ENV=test in Vercel production', () => {
      const env = asProcessEnv({ NODE_ENV: 'test', VERCEL_ENV: 'production' });
      expect(() => resolveEvalEnvContract(env)).toThrow('NODE_ENV=test is not permitted in Vercel production');
    });

    it('throws when FLOW1_EVIDENCE=1 in Vercel production', () => {
      const env = asProcessEnv({ NODE_ENV: 'production', VERCEL_ENV: 'production', FLOW1_EVIDENCE: '1' });
      expect(() => resolveEvalEnvContract(env)).toThrow('FLOW1_EVIDENCE=1 is not permitted in Vercel production');
    });

    it('throws when FLOW_A7_EVIDENCE=1 in Vercel production', () => {
      const env = asProcessEnv({ NODE_ENV: 'production', VERCEL_ENV: 'production', FLOW_A7_EVIDENCE: '1' });
      expect(() => resolveEvalEnvContract(env)).toThrow('FLOW_A7_EVIDENCE=1 is not permitted in Vercel production');
    });
  });

  describe('USE_REAL_LLM', () => {
    it('throws when USE_REAL_LLM=true', () => {
      const env = { ...BASE_ENV, USE_REAL_LLM: 'true' };
      expect(() => resolveEvalEnvContract(env)).toThrow('USE_REAL_LLM=true is never permitted');
    });

    it('does not throw when USE_REAL_LLM=false', () => {
      const env = { ...BASE_ENV, USE_REAL_LLM: 'false' };
      expect(() => resolveEvalEnvContract(env)).not.toThrow();
    });

    it('does not throw when USE_REAL_LLM is absent', () => {
      expect(() => resolveEvalEnvContract(BASE_ENV)).not.toThrow();
    });
  });

  describe('evidence mode detection', () => {
    it('isEvidenceMode is true when CI=true', () => {
      const env = { ...BASE_ENV, CI: 'true' };
      const contract = resolveEvalEnvContract(env);
      expect(contract.isEvidenceMode).toBe(true);
    });

    it('isEvidenceMode is true when NODE_ENV=test', () => {
      const contract = resolveEvalEnvContract(BASE_ENV);
      expect(contract.isEvidenceMode).toBe(true);
    });

    it('isEvidenceMode is true when FLOW1_EVIDENCE=1', () => {
      const env = { ...BASE_ENV, FLOW1_EVIDENCE: '1' };
      const contract = resolveEvalEnvContract(env);
      expect(contract.isEvidenceMode).toBe(true);
    });

    it('isEvidenceMode is true when FLOW_A7_EVIDENCE=1', () => {
      const env = { ...BASE_ENV, FLOW_A7_EVIDENCE: '1' };
      const contract = resolveEvalEnvContract(env);
      expect(contract.isEvidenceMode).toBe(true);
    });

    it('isEvidenceMode is false with no evidence signals', () => {
      const env: NodeJS.ProcessEnv = { NODE_ENV: 'development' };
      const contract = resolveEvalEnvContract(env);
      expect(contract.isEvidenceMode).toBe(false);
    });
  });
});
