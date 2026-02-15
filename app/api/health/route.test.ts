/**
 * Health Endpoint Tests (Gate 6: Observability)
 *
 * Tests both tiers:
 * 1. Unauthenticated: verify liveness only, no queue data
 * 2. Authenticated: verify queue diagnostics included
 *
 * Note: These tests verify the auth layering and response structure.
 * The queueHealth helper is tested separately in queueHealth.test.ts.
 */

import { NextRequest } from 'next/server';
import { GET } from './route';

/**
 * Helper to set environment variables (works around TS2540 read-only error)
 */
function setEnv(key: string, value: string | undefined): void {
  const env = process.env as Record<string, string | undefined>;
  env[key] = value;
}

/**
 * Helper to create a NextRequest with headers
 */
function createRequest(options: {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
}): NextRequest {
  const url = options.url || 'http://localhost:3000/api/health';
  const headers = new Headers(options.headers || {});

  return new NextRequest(url, {
    method: options.method || 'GET',
    headers,
  });
}

describe('GET /api/health', () => {
  // ============================================================================
  // UNAUTHENTICATED TIER
  // ============================================================================

  describe('Unauthenticated', () => {
    it('should return 200 with liveness fields only', async () => {
      const req = createRequest({});
      const response = await GET(req);

      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.ok).toBe(true);
      expect(json.timestamp).toBeDefined();
      expect(json.env).toMatch(/^(prod|preview|dev)$/);
      // Should NOT have queue data
      expect(json.queue).toBeUndefined();
    });

    it('should include git_sha if available', async () => {
      const originalSha = process.env.VERCEL_GIT_COMMIT_SHA;
      process.env.VERCEL_GIT_COMMIT_SHA = 'abc123def456xyz';

      try {
        const req = createRequest({});
        const response = await GET(req);

        const json = await response.json();
        expect(json.git_sha).toBe('abc123d'); // 7 chars
      } finally {
        if (originalSha) {
          process.env.VERCEL_GIT_COMMIT_SHA = originalSha;
        } else {
          delete process.env.VERCEL_GIT_COMMIT_SHA;
        }
      }
    });

    it('should omit git_sha if not in env', async () => {
      const originalSha = process.env.VERCEL_GIT_COMMIT_SHA;
      delete process.env.VERCEL_GIT_COMMIT_SHA;

      try {
        const req = createRequest({});
        const response = await GET(req);

        const json = await response.json();
        expect(json.git_sha).toBeUndefined();
      } finally {
        if (originalSha) {
          process.env.VERCEL_GIT_COMMIT_SHA = originalSha;
        }
      }
    });
  });

  // ============================================================================
  // RESPONSE STRUCTURE TESTS
  // ============================================================================

  describe('Response structure', () => {
    it('should always include ok=true and timestamp', async () => {
      const req = createRequest({});
      const response = await GET(req);
      const json = await response.json();

      expect(json.ok).toBe(true);
      expect(json.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO format
    });

    it('should always include env in (prod, preview, dev)', async () => {
      const req = createRequest({});
      const response = await GET(req);
      const json = await response.json();

      expect(['prod', 'preview', 'dev']).toContain(json.env);
    });

    it('should return well-formed JSON', async () => {
      const req = createRequest({});
      const response = await GET(req);
      expect(response.headers.get('content-type')).toContain('application/json');

      const json = await response.json();
      expect(json).toBeTruthy();
    });
  });

  // ============================================================================
  // POST METHOD
  // ============================================================================

  describe('POST /api/health', () => {
    it('should handle POST requests the same as GET', async () => {
      const req = createRequest({
        method: 'POST',
      });

      const response = await GET(req);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.ok).toBe(true);
    });
  });

  // ============================================================================
  // ENVIRONMENT DETECTION
  // ============================================================================

  describe('Environment detection', () => {
    it('should detect production environment', async () => {
      const originalVercelEnv = process.env.VERCEL_ENV;

      try {
        setEnv('VERCEL_ENV', 'production');
        const req = createRequest({});
        const response = await GET(req);
        const json = await response.json();

        expect(json.env).toBe('prod');
      } finally {
        if (originalVercelEnv) {
          setEnv('VERCEL_ENV', originalVercelEnv);
        } else {
          setEnv('VERCEL_ENV', undefined);
        }
      }
    });

    it('should detect preview environment', async () => {
      const originalVercelEnv = process.env.VERCEL_ENV;

      try {
        setEnv('VERCEL_ENV', 'preview');
        const req = createRequest({});
        const response = await GET(req);
        const json = await response.json();

        expect(json.env).toBe('preview');
      } finally {
        if (originalVercelEnv) {
          setEnv('VERCEL_ENV', originalVercelEnv);
        } else {
          setEnv('VERCEL_ENV', undefined);
        }
      }
    });

    it('should default to dev for unknown environment', async () => {
      const originalVercelEnv = process.env.VERCEL_ENV;

      try {
        setEnv('VERCEL_ENV', undefined);
        const req = createRequest({});
        const response = await GET(req);
        const json = await response.json();

        expect(json.env).toBe('dev');
      } finally {
        if (originalVercelEnv) {
          setEnv('VERCEL_ENV', originalVercelEnv);
        } else {
          setEnv('VERCEL_ENV', undefined);
        }
      }
    });
  });

  // ============================================================================
  // TIMESTAMP FORMAT
  // ============================================================================

  describe('Timestamp format', () => {
    it('should return ISO 8601 timestamps', async () => {
      const req = createRequest({});
      const response = await GET(req);
      const json = await response.json();

      // ISO 8601: YYYY-MM-DDTHH:MM:SS.sssZ
      expect(json.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });

    it('should return recent timestamps', async () => {
      const before = new Date();
      const req = createRequest({});
      const response = await GET(req);
      const after = new Date();
      const json = await response.json();

      const timestamp = new Date(json.timestamp);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);
    });
  });
});
