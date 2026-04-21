import { resolveEnvContract, __resetEnvContract } from '../envContract';

const BASE_ENV = {
  OPENAI_API_KEY: 'sk-test-openai',
  PERPLEXITY_API_KEY: 'pplx-test',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  NODE_ENV: 'test',
} as unknown as NodeJS.ProcessEnv;

beforeEach(() => {
  __resetEnvContract();
});

describe('resolveEnvContract', () => {
  it('returns a valid contract when all required vars are present', () => {
    const contract = resolveEnvContract(BASE_ENV);
    expect(contract.OPENAI_API_KEY).toBe('sk-test-openai');
    expect(contract.EVALUATION_TIMEOUT_MS).toBe(180_000);
    expect(contract.NODE_ENV).toBe('test');
  });

  it('uses EVALUATION_TIMEOUT_MS override when provided', () => {
    const env = { ...BASE_ENV, EVALUATION_TIMEOUT_MS: '60000' };
    const contract = resolveEnvContract(env as NodeJS.ProcessEnv);
    expect(contract.EVALUATION_TIMEOUT_MS).toBe(60_000);
  });

  it('throws when a required var is missing', () => {
    const { OPENAI_API_KEY: _, ...rest } = BASE_ENV as Record<string, string>;
    expect(() => resolveEnvContract(rest as NodeJS.ProcessEnv)).toThrow(
      '[envContract] Missing required environment variable: OPENAI_API_KEY'
    );
  });

  it('throws when a required var is empty string', () => {
    const env = { ...BASE_ENV, SUPABASE_URL: '  ' };
    expect(() => resolveEnvContract(env as NodeJS.ProcessEnv)).toThrow(
      '[envContract] Missing required environment variable: SUPABASE_URL'
    );
  });

  it('throws when EVALUATION_TIMEOUT_MS is not a positive integer', () => {
    const env = { ...BASE_ENV, EVALUATION_TIMEOUT_MS: '-1' };
    expect(() => resolveEnvContract(env as NodeJS.ProcessEnv)).toThrow(
      'must be a positive integer'
    );
  });

  it('returns undefined for EVALUATION_MODELS when not set', () => {
    const contract = resolveEnvContract(BASE_ENV);
    expect(contract.EVALUATION_MODELS).toBeUndefined();
  });

  it('parses EVALUATION_MODELS when provided', () => {
    const env = { ...BASE_ENV, EVALUATION_MODELS: 'gpt-4o,o3' };
    const contract = resolveEnvContract(env as NodeJS.ProcessEnv);
    expect(contract.EVALUATION_MODELS).toBe('gpt-4o,o3');
  });
});
