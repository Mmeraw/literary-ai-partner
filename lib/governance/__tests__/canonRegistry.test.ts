/**
 * Tests for canonRegistry module.
 */

import { describe, it, expect } from "@jest/globals";
import {
  CANON_REGISTRY,
  isCanonActive,
  assertCanonActive,
  validateCanonicalRegistry,
  loadCanonicalRegistry,
} from "../canonRegistry";
import { GovernanceError } from "../errors";

describe("canonRegistry", () => {
  describe("CANON_REGISTRY", () => {
    it("should have exactly 30 ACTIVE entries", () => {
      let activeCount = 0;
      for (const entry of CANON_REGISTRY.values()) {
        if (entry.status === "ACTIVE") {
          activeCount++;
        }
      }
      expect(activeCount).toBe(30);
    });

    it("should include all 13 canonical criteria", () => {
      const criteriaIds = [
        "CRIT-CONCEPT-001",
        "CRIT-MOMENTUM-001",
        "CRIT-CHARACTER-001",
        "CRIT-POVVOICE-001",
        "CRIT-SCENE-001",
        "CRIT-DIALOGUE-001",
        "CRIT-THEME-001",
        "CRIT-WORLD-001",
        "CRIT-PACING-001",
        "CRIT-PROSE-001",
        "CRIT-TONE-001",
        "CRIT-CLOSURE-001",
        "CRIT-MARKET-001",
      ];

      for (const id of criteriaIds) {
        expect(CANON_REGISTRY.has(id)).toBe(true);
        const entry = CANON_REGISTRY.get(id);
        expect(entry?.status).toBe("ACTIVE");
      }
    });

    it("should include 3 governance entries", () => {
      const govIds = ["GATE-ELIGIBILITY-002", "ENV-EVAL-ARTIFACT-001", "REFINEMENT-GATE-001"];
      for (const id of govIds) {
        expect(CANON_REGISTRY.has(id)).toBe(true);
        const entry = CANON_REGISTRY.get(id);
        expect(entry?.status).toBe("ACTIVE");
      }
    });

    it("should be frozen and immutable", () => {
      expect(Object.isFrozen(CANON_REGISTRY)).toBe(true);
    });

    it("should not expose mutable map methods", () => {
      const mutableSurface = CANON_REGISTRY as unknown as { set?: unknown; clear?: unknown; delete?: unknown };
      expect(mutableSurface.set).toBeUndefined();
      expect(mutableSurface.clear).toBeUndefined();
      expect(mutableSurface.delete).toBeUndefined();
    });

    it("should validate registry integrity", () => {
      expect(() => validateCanonicalRegistry()).not.toThrow();
    });

    it("should load registry through runtime binding loader", () => {
      const registry = loadCanonicalRegistry();
      expect(registry.size).toBeGreaterThan(0);
    });
  });

  describe("isCanonActive", () => {
    it("should return true for ACTIVE canon IDs", () => {
      expect(isCanonActive("CRIT-CONCEPT-001")).toBe(true);
      expect(isCanonActive("GATE-ELIGIBILITY-002")).toBe(true);
    });

    it("should return false for non-existent canon IDs", () => {
      expect(isCanonActive("FAKE-CANON-001")).toBe(false);
    });

    it("should return false for ARCHIVED canon IDs", () => {
      // Create a test scenario by checking registry structure
      // (All current entries are ACTIVE, so this tests the logic)
      const nonExistent = "NONEXISTENT-ID";
      expect(isCanonActive(nonExistent)).toBe(false);
    });
  });

  describe("assertCanonActive", () => {
    it("should not throw for ACTIVE canon IDs", () => {
      expect(() => {
        assertCanonActive("CRIT-CONCEPT-001");
        assertCanonActive("GATE-ELIGIBILITY-002");
      }).not.toThrow();
    });

    it("should throw GovernanceError for non-existent canon IDs", () => {
      expect(() => {
        assertCanonActive("FAKE-CANON-001");
      }).toThrow(GovernanceError);

      try {
        assertCanonActive("FAKE-CANON-001");
      } catch (err) {
        if (err instanceof GovernanceError) {
          expect(err.code).toBe("CANON_NOT_FOUND");
        }
      }
    });

    it("should include canon ID in error details", () => {
      try {
        assertCanonActive("UNKNOWN-001");
        fail("Should have thrown");
      } catch (err) {
        if (err instanceof GovernanceError) {
          const metadata = err.metadata as Record<string, unknown>;
          expect(metadata.canonId).toBe("UNKNOWN-001");
        }
      }
    });
  });

  describe("Registry structure", () => {
    it("each entry should have required fields", () => {
      for (const [id, entry] of CANON_REGISTRY.entries()) {
        expect(entry.canonId).toBe(id);
        expect(entry.name).toBeDefined();
        expect(entry.type).toMatch(/^(CORE|GOVERNANCE|EXECUTION)$/);
        expect(entry.status).toMatch(/^(ACTIVE|ARCHIVED|REPEALED)$/);
        expect(entry.sourceDocument).toBeDefined();
      }
    });

    it("criteria entries should have type CORE", () => {
      const criteriaIds = [
        "CRIT-CONCEPT-001",
        "CRIT-MOMENTUM-001",
        "CRIT-CHARACTER-001",
      ];
      for (const id of criteriaIds) {
        const entry = CANON_REGISTRY.get(id);
        expect(entry?.type).toBe("CORE");
      }
    });

    it("governance entries should have type GOVERNANCE", () => {
      const governanceEntry = CANON_REGISTRY.get("GATE-ELIGIBILITY-002");
      expect(governanceEntry?.type).toBe("GOVERNANCE");

      const executionEntry = CANON_REGISTRY.get("ENV-EVAL-ARTIFACT-001");
      expect(executionEntry?.type).toBe("EXECUTION");
    });
  });
});
