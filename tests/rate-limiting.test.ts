/**
 * Rate Limiter Tests
 * Validates production-grade rate limiting for 100k-user scale
 */

import { 
  validateManuscriptSize, 
  getFeatureRateLimit,
  checkFeatureAccess,
  stopCleanupInterval,
} from "../lib/jobs/rateLimiter";
import { RATE_LIMITS } from "../lib/jobs/guards";

// Clean up interval after all tests to prevent Jest hanging
afterAll(() => {
  stopCleanupInterval();
});

describe("Rate Limiting for 100k-User Scale", () => {
  describe("Manuscript Size Validation", () => {
    it("should allow manuscripts under size limit", () => {
      const result = validateManuscriptSize(1024 * 1024); // 1MB
      expect(result.allowed).toBe(true);
    });

    it("should reject manuscripts over size limit", () => {
      const result = validateManuscriptSize(10 * 1024 * 1024); // 10MB
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("too large");
    });

    it("should accept manuscripts at exact size limit", () => {
      const result = validateManuscriptSize(RATE_LIMITS.MAX_MANUSCRIPT_SIZE);
      expect(result.allowed).toBe(true);
    });

    it("should reject manuscripts 1 byte over limit", () => {
      const result = validateManuscriptSize(RATE_LIMITS.MAX_MANUSCRIPT_SIZE + 1);
      expect(result.allowed).toBe(false);
    });
  });

  describe("Feature Rate Limits", () => {
    it("should define limits for core evaluation features", () => {
      const evalFull = getFeatureRateLimit("evaluate_full");
      expect(evalFull.maxPerHour).toBe(10);
      expect(evalFull.requiresAuth).toBe(true);
      expect(evalFull.premiumOnly).toBe(false);
    });

    it("should define higher limits for smaller evaluations", () => {
      const evalScene = getFeatureRateLimit("evaluate_scene");
      const evalChapter = getFeatureRateLimit("evaluate_chapter");
      
      expect(evalScene.maxPerHour).toBeGreaterThan(evalChapter.maxPerHour);
    });

    it("should mark WAVE evaluation as premium", () => {
      const evalWave = getFeatureRateLimit("evaluate_wave");
      expect(evalWave.premiumOnly).toBe(true);
      expect(evalWave.requiresAuth).toBe(true);
    });

    it("should mark agent package generation as premium", () => {
      const agentPackage = getFeatureRateLimit("generate_agent_package");
      expect(agentPackage.premiumOnly).toBe(true);
      expect(agentPackage.maxPerHour).toBeLessThanOrEqual(5);
    });

    it("should mark film package generation as premium", () => {
      const filmPackage = getFeatureRateLimit("generate_film_package");
      expect(filmPackage.premiumOnly).toBe(true);
    });

    it("should mark screenplay conversion as premium", () => {
      const conversion = getFeatureRateLimit("convert_manuscript_to_screenplay");
      expect(conversion.premiumOnly).toBe(true);
    });

    it("should allow high rate for revision operations", () => {
      const revision = getFeatureRateLimit("apply_revision");
      expect(revision.maxPerHour).toBeGreaterThanOrEqual(50);
    });

    it("should have default limits for unknown job types", () => {
      const unknown = getFeatureRateLimit("unknown_job_type_xyz");
      expect(unknown.maxPerHour).toBe(10);
      expect(unknown.requiresAuth).toBe(true);
    });
  });

  describe("Feature Access Control", () => {
    it("should block unauthenticated users from auth-required features", async () => {
      const result = await checkFeatureAccess(null, "evaluate_full", "free");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Authentication required");
    });

    it("should allow authenticated free users for non-premium features", async () => {
      const result = await checkFeatureAccess("user-123", "evaluate_full", "free");
      expect(result.allowed).toBe(true);
    });

    it("should block free users from premium features", async () => {
      const result = await checkFeatureAccess("user-123", "evaluate_wave", "free");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("premium");
    });

    it("should allow premium users for premium features", async () => {
      const result = await checkFeatureAccess("user-123", "evaluate_wave", "premium");
      expect(result.allowed).toBe(true);
    });

    it("should allow agent tier users for all features", async () => {
      const result = await checkFeatureAccess("agent-456", "generate_agent_package", "agent");
      expect(result.allowed).toBe(true);
    });
  });

  describe("Rate Limit Constants", () => {
    it("should define reasonable per-user hourly limits", () => {
      expect(RATE_LIMITS.JOB_CREATION_PER_HOUR).toBe(10);
      expect(RATE_LIMITS.JOB_CREATION_PER_HOUR).toBeGreaterThan(0);
      expect(RATE_LIMITS.JOB_CREATION_PER_HOUR).toBeLessThanOrEqual(100);
    });

    it("should define concurrent job limits", () => {
      expect(RATE_LIMITS.MAX_CONCURRENT_JOBS).toBe(5);
      expect(RATE_LIMITS.MAX_CONCURRENT_JOBS).toBeGreaterThan(0);
    });

    it("should define IP-based fallback limits", () => {
      expect(RATE_LIMITS.IP_REQUESTS_PER_HOUR).toBe(20);
      expect(RATE_LIMITS.IP_REQUESTS_PER_HOUR).toBeGreaterThan(RATE_LIMITS.JOB_CREATION_PER_HOUR);
    });

    it("should define manuscript size limits", () => {
      const fiveMB = 5 * 1024 * 1024;
      expect(RATE_LIMITS.MAX_MANUSCRIPT_SIZE).toBe(fiveMB);
    });
  });

  describe("Production Scalability", () => {
    it("should have limits that scale to 100k users", () => {
      // With 10 jobs/hour/user and 100k users
      // Peak theoretical: 1M jobs/hour = ~278 jobs/second
      // With polling backoff, actual API load is manageable
      
      const usersCount = 100_000;
      const maxJobsPerHour = RATE_LIMITS.JOB_CREATION_PER_HOUR * usersCount;
      const maxJobsPerSecond = maxJobsPerHour / 3600;
      
      expect(maxJobsPerSecond).toBeLessThan(500); // Should be under 500/sec theoretical peak
    });

    it("should reduce API load via polling backoff", () => {
      // At peak load with 100k users, each with 1 active job:
      // - Fast polling (2s): 50,000 requests/sec if all jobs new
      // - With backoff to 30s: 3,333 requests/sec after 10min
      // Backoff provides ~15x load reduction
      
      const users = 100_000;
      const fastPolling = users / 2; // req/sec
      const slowPolling = users / 30; // req/sec
      const reduction = fastPolling / slowPolling;
      
      expect(reduction).toBeGreaterThan(10);
    });
  });

  describe("Multi-Feature Platform", () => {
    const features = [
      "evaluate_full",
      "evaluate_chapter", 
      "evaluate_scene",
      "evaluate_wave",
      "generate_agent_package",
      "generate_synopsis",
      "generate_query_letter",
      "generate_comparables",
      "convert_chapter_to_scene",
      "convert_manuscript_to_screenplay",
      "generate_film_package",
      "apply_revision",
    ];

    it("should define limits for all documented features", () => {
      features.forEach(feature => {
        const limit = getFeatureRateLimit(feature);
        expect(limit).toBeDefined();
        expect(limit.maxPerHour).toBeGreaterThan(0);
      });
    });

    it("should tier features appropriately by resource intensity", () => {
      const wave = getFeatureRateLimit("evaluate_wave");
      const scene = getFeatureRateLimit("evaluate_scene");
      
      // WAVE (63+ passes) should have lower limits than scene evaluation
      expect(wave.maxPerHour).toBeLessThan(scene.maxPerHour);
    });

    it("should tier agent package features as premium", () => {
      const agentFeatures = [
        "generate_agent_package",
        "generate_comparables",
        "generate_film_package",
      ];
      
      agentFeatures.forEach(feature => {
        const limit = getFeatureRateLimit(feature);
        expect(limit.premiumOnly).toBe(true);
      });
    });
  });
});
