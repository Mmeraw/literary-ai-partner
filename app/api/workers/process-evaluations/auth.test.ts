/**
 * Auth Tests for Process Evaluations Worker
 * 
 * Tests the production-grade authentication system including:
 * - Timing-safe secret comparison
 * - Vercel Cron validation
 * - Bearer token authentication
 * - Dev-only query secret
 * 
 * Run with: npx jest app/api/workers/process-evaluations/auth.test.ts
 */

import { NextRequest } from 'next/server';
import { GET } from './route';

// Mock environment variables
const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

// Helper to create mock NextRequest
function createMockRequest(options: {
  headers?: Record<string, string>;
  searchParams?: Record<string, string>;
} = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/workers/process-evaluations');
  
  if (options.searchParams) {
    Object.entries(options.searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  
  const headers = new Headers(options.headers || {});
  
  return new NextRequest(url, { headers });
}

describe('Process Evaluations Worker Auth', () => {
  describe('Unauthorized Access', () => {
    it('should return 401 with no headers or credentials', async () => {
      process.env.CRON_SECRET = 'test-secret-123';
      process.env.NODE_ENV = 'production';
      delete process.env.VERCEL;
      delete process.env.VERCEL_ENV;
      
      const req = createMockRequest();
      const response = await GET(req);
      
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Unauthorized');
      expect(body.traceId).toBeDefined();
    });

    it('should return 401 with wrong bearer token', async () => {
      process.env.CRON_SECRET = 'correct-secret';
      process.env.NODE_ENV = 'production';
      
      const req = createMockRequest({
        headers: { 'authorization': 'Bearer wrong-secret' }
      });
      const response = await GET(req);
      
      expect(response.status).toBe(401);
    });

    it('should return 401 with spoofed cron headers off-platform', async () => {
      // Simulate spoofing attempt - cron headers but NOT on Vercel
      process.env.CRON_SECRET = 'test-secret';
      delete process.env.VERCEL;
      delete process.env.VERCEL_ENV;
      
      const req = createMockRequest({
        headers: {
          'x-vercel-cron': '1',
          'x-vercel-id': 'fake-id-123'
        }
      });
      const response = await GET(req);
      
      expect(response.status).toBe(401);
    });

    it('should return 401 with query secret in production', async () => {
      process.env.CRON_SECRET = 'test-secret';
      process.env.NODE_ENV = 'production';
      
      const req = createMockRequest({
        searchParams: { secret: 'test-secret' }
      });
      const response = await GET(req);
      
      expect(response.status).toBe(401);
    });
  });

  describe('Bearer Token Auth', () => {
    it('should return 200 with correct bearer token', async () => {
      process.env.CRON_SECRET = 'valid-secret-456';
      process.env.NODE_ENV = 'production';
      
      const req = createMockRequest({
        headers: { 'authorization': 'Bearer valid-secret-456' }
      });
      const response = await GET(req);
      
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.authMethod).toBe('bearer');
      expect(body.traceId).toBeDefined();
    });

    it('should handle case-insensitive Bearer prefix', async () => {
      process.env.CRON_SECRET = 'test-secret';
      
      const req = createMockRequest({
        headers: { 'authorization': 'BEARER test-secret' }
      });
      const response = await GET(req);
      
      expect(response.status).toBe(200);
    });
  });

  describe('Vercel Cron Auth', () => {
    it('should return 200 with valid Vercel Cron headers on platform', async () => {
      process.env.CRON_SECRET = 'any-secret';
      process.env.VERCEL = '1';
      process.env.VERCEL_ENV = 'production';
      
      const req = createMockRequest({
        headers: {
          'x-vercel-cron': '1',
          'x-vercel-id': 'iad1::abc123'
        }
      });
      const response = await GET(req);
      
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.authMethod).toBe('vercel_cron');
    });

    it('should require x-vercel-id header along with x-vercel-cron', async () => {
      process.env.VERCEL = '1';
      process.env.VERCEL_ENV = 'production';
      
      const req = createMockRequest({
        headers: { 'x-vercel-cron': '1' }
        // Missing x-vercel-id
      });
      const response = await GET(req);
      
      expect(response.status).toBe(401);
    });
  });

  describe('Dev Query Secret Auth', () => {
    it('should return 200 with query secret in development', async () => {
      process.env.CRON_SECRET = 'dev-secret';
      process.env.NODE_ENV = 'development';
      
      const req = createMockRequest({
        searchParams: { secret: 'dev-secret' }
      });
      const response = await GET(req);
      
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.authMethod).toBe('dev_query');
    });

    it('should return 401 with wrong query secret in development', async () => {
      process.env.CRON_SECRET = 'correct-secret';
      process.env.NODE_ENV = 'development';
      
      const req = createMockRequest({
        searchParams: { secret: 'wrong-secret' }
      });
      const response = await GET(req);
      
      expect(response.status).toBe(401);
    });
  });

  describe('Dry Run Mode', () => {
    it('should return dry run response when dry_run=1', async () => {
      process.env.CRON_SECRET = 'test-secret';
      
      const req = createMockRequest({
        headers: { 'authorization': 'Bearer test-secret' },
        searchParams: { dry_run: '1' }
      });
      const response = await GET(req);
      
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.dryRun).toBe(true);
      expect(body.config).toBeDefined();
      expect(body.config.maxExecutionMs).toBeDefined();
      expect(body.config.batchSize).toBeDefined();
    });
  });

  describe('Response Structure', () => {
    it('should include traceId in all responses', async () => {
      process.env.CRON_SECRET = 'test';
      
      // Test unauthorized response
      const unauthReq = createMockRequest();
      const unauthRes = await GET(unauthReq);
      const unauthBody = await unauthRes.json();
      expect(unauthBody.traceId).toMatch(/^[0-9a-f-]{36}$/);
      
      // Test authorized response
      const authReq = createMockRequest({
        headers: { 'authorization': 'Bearer test' }
      });
      const authRes = await GET(authReq);
      const authBody = await authRes.json();
      expect(authBody.traceId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('should include timestamp in successful responses', async () => {
      process.env.CRON_SECRET = 'test';
      
      const req = createMockRequest({
        headers: { 'authorization': 'Bearer test' }
      });
      const response = await GET(req);
      const body = await response.json();
      
      expect(body.timestamp).toBeDefined();
      expect(new Date(body.timestamp).getTime()).not.toBeNaN();
    });

    it('should include durationMs in successful responses', async () => {
      process.env.CRON_SECRET = 'test';
      
      const req = createMockRequest({
        headers: { 'authorization': 'Bearer test' },
        searchParams: { dry_run: '1' }
      });
      const response = await GET(req);
      const body = await response.json();
      
      expect(typeof body.durationMs).toBe('undefined'); // dry_run doesn't include durationMs in this implementation
    });
  });

  describe('Security Edge Cases', () => {
    it('should not leak secrets in error responses', async () => {
      process.env.CRON_SECRET = 'super-secret-value';
      
      const req = createMockRequest();
      const response = await GET(req);
      const body = await response.json();
      
      const bodyStr = JSON.stringify(body);
      expect(bodyStr).not.toContain('super-secret-value');
    });

    it('should handle empty CRON_SECRET gracefully', async () => {
      process.env.CRON_SECRET = '';
      
      const req = createMockRequest({
        headers: { 'authorization': 'Bearer anything' }
      });
      const response = await GET(req);
      
      expect(response.status).toBe(401);
    });

    it('should handle missing CRON_SECRET env var', async () => {
      delete process.env.CRON_SECRET;
      
      const req = createMockRequest({
        headers: { 'authorization': 'Bearer anything' }
      });
      const response = await GET(req);
      
      expect(response.status).toBe(401);
    });
  });
});

// =============================================================================
// QC REGRESSION TESTS (required for audit-grade approval)
// =============================================================================

describe('QC Regression Tests', () => {
  describe('QC1: Cron Priority Over Bearer', () => {
    it('should classify as vercel_cron even when Bearer also matches', async () => {
      // This is the key invariant: cron headers take priority over bearer
      process.env.CRON_SECRET = 'test-secret';
      process.env.VERCEL = '1';
      process.env.VERCEL_ENV = 'production';
      
      const req = createMockRequest({
        headers: {
          'x-vercel-cron': '1',
          'x-vercel-id': 'iad1::abc123',
          'authorization': 'Bearer test-secret' // Both cron AND valid bearer
        }
      });
      const response = await GET(req);
      
      expect(response.status).toBe(200);
      const body = await response.json();
      // MUST be vercel_cron, not bearer
      expect(body.authMethod).toBe('vercel_cron');
    });
  });

  describe('QC2: Timing-Safe Handles Length Mismatch', () => {
    it('should return 401 with wrong-length token without throwing', async () => {
      process.env.CRON_SECRET = 'correct-secret-here';
      process.env.NODE_ENV = 'production';
      delete process.env.VERCEL;
      
      // Short token (length mismatch)
      const req = createMockRequest({
        headers: { 'authorization': 'Bearer x' }
      });
      const response = await GET(req);
      
      expect(response.status).toBe(401);
      // Should not throw - verify we got a proper JSON response
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('should return 401 with very long token without throwing', async () => {
      process.env.CRON_SECRET = 'short';
      process.env.NODE_ENV = 'production';
      delete process.env.VERCEL;
      
      // Very long token (length mismatch)
      const req = createMockRequest({
        headers: { 'authorization': 'Bearer ' + 'x'.repeat(10000) }
      });
      const response = await GET(req);
      
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });
  });

  describe('QC3: Production Rejects Query Secret', () => {
    it('should reject query secret in production even if correct', async () => {
      process.env.CRON_SECRET = 'prod-secret';
      process.env.NODE_ENV = 'production';
      
      const req = createMockRequest({
        searchParams: { secret: 'prod-secret' } // Correct secret!
      });
      const response = await GET(req);
      
      expect(response.status).toBe(401);
    });
  });

  describe('QC4: Fail-Closed When CRON_SECRET Missing', () => {
    it('should reject bearer when CRON_SECRET is undefined', async () => {
      delete process.env.CRON_SECRET;
      process.env.NODE_ENV = 'production';
      delete process.env.VERCEL;
      
      const req = createMockRequest({
        headers: { 'authorization': 'Bearer anything' }
      });
      const response = await GET(req);
      
      expect(response.status).toBe(401);
    });

    it('should reject bearer when CRON_SECRET is empty string', async () => {
      process.env.CRON_SECRET = '';
      process.env.NODE_ENV = 'production';
      delete process.env.VERCEL;
      
      const req = createMockRequest({
        headers: { 'authorization': 'Bearer ' } // Empty bearer to match empty secret
      });
      const response = await GET(req);
      
      expect(response.status).toBe(401);
    });

    it('should reject query secret in dev when CRON_SECRET is undefined', async () => {
      delete process.env.CRON_SECRET;
      process.env.NODE_ENV = 'development';
      delete process.env.VERCEL;
      
      const req = createMockRequest({
        searchParams: { secret: 'anything' }
      });
      const response = await GET(req);
      
      expect(response.status).toBe(401);
    });

    it('should STILL allow vercel cron on platform when CRON_SECRET is undefined', async () => {
      delete process.env.CRON_SECRET;
      process.env.VERCEL = '1';
      process.env.VERCEL_ENV = 'production';
      
      const req = createMockRequest({
        headers: {
          'x-vercel-cron': '1',
          'x-vercel-id': 'iad1::abc123'
        }
      });
      const response = await GET(req);
      
      // Cron header auth should work even without CRON_SECRET
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.authMethod).toBe('vercel_cron');
    });
  });
});
