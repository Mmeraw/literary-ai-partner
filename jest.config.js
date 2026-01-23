const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  testEnvironment: "node",
  testMatch: ["**/?(*.)+(test).[tj]s?(x)"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  setupFiles: ["<rootDir>/jest.setup.ts"],
  testPathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/functions/tests/",
    "<rootDir>/supabase/functions/",
    "<rootDir>/.*_agent_verification.*\\.test\\.ts$",
    "<rootDir>/.*_industry_.*\\.test\\.ts$",
    "<rootDir>/.*evaluate_quick_submission_scope_s1_micro.*\\.test\\.ts$",
    "<rootDir>/.*sampleScopeEnforcement.*\\.test\\.ts$",
    "<rootDir>/.*integrityGate.*\\.test\\.ts$",
    "<rootDir>/tests/approveAgentVerification\\.test\\.ts$",
    "<rootDir>/integrity_gate_v1_huhu_micro_golden\\.test\\.ts$",
  ],
  // forceExit: true, // Removed to ensure proper async cleanup - tests should clean up after themselves
};

module.exports = createJestConfig(customJestConfig);
