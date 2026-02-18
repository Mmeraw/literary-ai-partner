/**
 * Unit tests for lib/jobs/config.ts — isProdRuntime guard logic
 *
 * Tests the security guard that prevents ALLOW_HEADER_USER_ID
 * from being used in real production runtime, while permitting
 * it in CI and during Next.js build phase.
 *
 * Because config.ts has module-level side effects (throws on import
 * when guard conditions are met), each test case uses jest.isolateModules
 * to get a fresh module evaluation with controlled env vars.
 */

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  // Restore env after each test
  process.env = { ...ORIGINAL_ENV };
  jest.resetModules();
});

describe("config.ts production guard", () => {
  it("throws when ALLOW_HEADER_USER_ID=true in prod runtime (not CI, not build)", () => {
    (process.env as any).NODE_ENV = "production";
    process.env.ALLOW_HEADER_USER_ID = "true";
    delete process.env.NEXT_PHASE;
    delete process.env.CI;

    expect(() => {
      jest.isolateModules(() => {
        require("@/lib/jobs/config");
      });
    }).toThrow(/SECURITY VIOLATION/);
  });

  it("does NOT throw when CI=true (even with prod + allow header)", () => {
    (process.env as any).NODE_ENV = "production";
    process.env.ALLOW_HEADER_USER_ID = "true";
    process.env.CI = "true";
    delete process.env.NEXT_PHASE;

    expect(() => {
      jest.isolateModules(() => {
        require("@/lib/jobs/config");
      });
    }).not.toThrow();
  });

  it("does NOT throw during Next.js build phase", () => {
    (process.env as any).NODE_ENV = "production";
    process.env.ALLOW_HEADER_USER_ID = "true";
    process.env.NEXT_PHASE = "phase-production-build";
    delete process.env.CI;

    expect(() => {
      jest.isolateModules(() => {
        require("@/lib/jobs/config");
      });
    }).not.toThrow();
  });

  it("does NOT throw in development mode", () => {
    (process.env as any).NODE_ENV = "development";
    process.env.ALLOW_HEADER_USER_ID = "true";
    delete process.env.CI;
    delete process.env.NEXT_PHASE;

    expect(() => {
      jest.isolateModules(() => {
        require("@/lib/jobs/config");
      });
    }).not.toThrow();
  });

  it("does NOT throw when ALLOW_HEADER_USER_ID is not set", () => {
    (process.env as any).NODE_ENV = "production";
    delete process.env.ALLOW_HEADER_USER_ID;
    delete process.env.CI;
    delete process.env.NEXT_PHASE;

    expect(() => {
      jest.isolateModules(() => {
        require("@/lib/jobs/config");
      });
    }).not.toThrow();
  });

  it("exports correct _test values in CI environment", () => {
    (process.env as any).NODE_ENV = "production";
    process.env.CI = "true";
    delete process.env.NEXT_PHASE;

    let testExports: { isProdRuntime: boolean; isNextBuild: boolean; isCI: boolean };
    jest.isolateModules(() => {
      const config = require("@/lib/jobs/config");
      testExports = config._test;
    });

    expect(testExports!.isCI).toBe(true);
    expect(testExports!.isNextBuild).toBe(false);
    expect(testExports!.isProdRuntime).toBe(false);
  });

  it("error message includes diagnostic env values when thrown", () => {
    (process.env as any).NODE_ENV = "production";
    process.env.ALLOW_HEADER_USER_ID = "true";
    delete process.env.NEXT_PHASE;
    delete process.env.CI;

    try {
      jest.isolateModules(() => {
        require("@/lib/jobs/config");
      });
      fail("Expected config.ts to throw");
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toContain("NODE_ENV=production");
      expect(msg).toContain("NEXT_PHASE=(unset)");
      expect(msg).toContain("CI=(unset)");
      expect(msg).toContain("ALLOW_HEADER_USER_ID=true");
    }
  });
});
