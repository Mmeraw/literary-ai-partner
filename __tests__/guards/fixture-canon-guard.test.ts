/**
 * Fixture Canon Guard — RevisionGrade
 *
 * Purpose: Prove that shared "valid" fixtures are actually valid
 * under current doctrine. If canon changes and the fixture builder
 * drifts, this fails immediately.
 *
 * This suite is the real tripwire. It runs in CI on every PR.
 */
import { buildValidPassArtifact, buildValidConvergenceArtifact } from "../helpers/buildValidPassArtifact";
import { assertCanonCompletePassArtifact } from "../helpers/assertCanonCompletePassArtifact";
import { enforceCriterionCompleteness } from "../../lib/jobs/invariants";
import { enforcePassSeparation } from "../../lib/jobs/invariants";
import { enforceAnchorIntegrity } from "../../lib/jobs/invariants";
import { enforceA6Credibility } from "../../lib/jobs/invariants";
import { CRITERIA_KEYS } from "../../schemas/criteria-keys";

describe("fixture canon guard", () => {
  const p1 = buildValidPassArtifact("pass1");
  const p2 = buildValidPassArtifact("pass2");
  const p3 = buildValidPassArtifact("pass3");
  const convergence = buildValidConvergenceArtifact(p1.id, p2.id, p3.id);

  describe("shared fixture builder produces canon-complete artifacts", () => {
    it("pass1 fixture passes assertCanonCompletePassArtifact", () => {
      expect(() => assertCanonCompletePassArtifact(p1)).not.toThrow();
    });

    it("pass2 fixture passes assertCanonCompletePassArtifact", () => {
      expect(() => assertCanonCompletePassArtifact(p2)).not.toThrow();
    });

    it("pass3 fixture passes assertCanonCompletePassArtifact", () => {
      expect(() => assertCanonCompletePassArtifact(p3)).not.toThrow();
    });
  });

  describe("shared fixtures satisfy all current invariants", () => {
    it("satisfies enforceCriterionCompleteness", () => {
      expect(() => enforceCriterionCompleteness(p1, p2, p3)).not.toThrow();
    });

    it("satisfies enforcePassSeparation", () => {
      expect(() => enforcePassSeparation(p1, p2, p3, convergence)).not.toThrow();
    });

    it("satisfies enforceAnchorIntegrity", () => {
      expect(() => enforceAnchorIntegrity(p1, p2, p3, convergence)).not.toThrow();
    });

    it("satisfies enforceA6Credibility", () => {
      expect(() => enforceA6Credibility(p1, p2, p3, convergence)).not.toThrow();
    });
  });

  describe("fixture builder aligns with CRITERIA_KEYS canon", () => {
    it("produces exactly 13 criteria", () => {
      expect(p1.criteria.length).toBe(CRITERIA_KEYS.length);
      expect(p1.criteria.length).toBe(13);
    });

    it("every criterion_id matches a CRITERIA_KEYS entry", () => {
      const keys = new Set<string>(CRITERIA_KEYS);
      for (const c of p1.criteria) {
        expect(keys.has(c.criterion_id)).toBe(true);
      }
    });

    it("no duplicate criterion_ids", () => {
      const ids = p1.criteria.map((c) => c.criterion_id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("overrides do not break canon compliance", () => {
    it("overriding summary still passes canon check", () => {
      const custom = buildValidPassArtifact("pass1", { summary: "Custom summary" });
      expect(() => assertCanonCompletePassArtifact(custom)).not.toThrow();
    });

    it("overriding job_id still passes canon check", () => {
      const custom = buildValidPassArtifact("pass1", { job_id: "custom-job" });
      expect(() => assertCanonCompletePassArtifact(custom)).not.toThrow();
    });
  });
});
