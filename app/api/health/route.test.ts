/**
 * Health Endpoint Tests (Gate 6: Observability)
 *
 * Tests both tiers:
 * 1. Unauthenticated: verify liveness only, no queue data
 * 2. Authenticated: verify queue diagnostics included
 */

import { NextRequest } from 'next/server';
import { GET } from './route';
import type { QueueHealthMetrics } from '@/lib/monitoring/healthThresholds';

// Mock the queue health helper
jest.mock('@/lib/monitoring/queueHealth');

const mockQueueHealth = require('@/lib/monitoring/queueHealth').getQueueHealth as jest.Mock;

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
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

    it('should never call getQueueHealth when unauthenticated', async () => {
      const req = createRequest({});
      await GET(req);

      expect(mockQueueHealth).not.toHaveBeenCalled();
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
  // AUTHENTICATED TIER (Bearer)
  // ============================================================================

  describe('Authenticated (Bearer)', () => {
    beforeEach(() => {
      process.env.CRON_SECRET = 'test-secret-xyz';
    });

    afterEach(() => {
      delete process.env.CRON_SECRET;
    });

    it('should include queue data with valid Bearer token', async () => {
      const mockMetrics: QueueHealthMetrics = {
        queued_count: 2,
        running_count: 1,
        failed_last_hour: 0,
        oldest_queued_seconds: 150,
        failure_rate_last_hour: 0.0,
        stuck_running_count: 0,
        stuck_running_oldest_seconds: null,
      };

      mockQueueHealth.mockResolvedValue({
        metrics: mockMetrics,
        classification: { health: 'healthy', reasons: ['Queue is processing normally'] },
      });

      const req = createRequest({
        headers: {
          authorization: 'Bearer test-secret-xyz',
        },
      });

      const response = await GET(req);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.ok).toBe(true);
      expect(json.queue).toBeDefined();
      expect(json.queue.metrics.queued_count).toBe(2);
      expect(json.queue.health).toBe('healthy');
      expect(json.queue.reasons).toEqual(['Queue is processing normally']);
      expect(mockQueueHealth).toHaveBeenCalledTimes(1);
    });

    it('should NOT include queue data with invalid Bearer token', async () => {
      const req = createRequest({
        headers: {
          authorization: 'Bearer wrong-secret',
        },
      });

      const response = await GET(req);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.queue).toBeUndefined();
      expect(mockQueueHealth).not.toHaveBeenCalled();
    });

    it('should handle queue health fetch errors gracefully', async () => {
      mockQueueHealth.mockRejectedValue(new Error('Database connection failed'));

      const req = createRequest({
        headers: {
          authorization: 'Bearer test-secret-xyz',
        },
      });

      const response = await GET(req);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.ok).toBe(true);
      expect(json.queue).toBeDefined();
      expect(json.queue.health).toBe('unknown');
      expect(json.queue.reasons[0]).toContain('Queue diagnostics unavailable');
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

    it('should NOT leak queue metrics in unauthenticated response', async () => {
      const req = createRequest({});
      const response = await GET(req);
      const json = await response.json();

      // Verify NO queue-related fields in public response
      expect(json.queue).toBeUndefined();
      expect(json.queued_count).toBeUndefined();
      expect(json.running_count).toBeUndefined();
      expect(json.failed_last_hour).toBeUndefined();
      expect(json.health).toBeUndefined();
      expect(json.metrics).toBeUndefined();
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
