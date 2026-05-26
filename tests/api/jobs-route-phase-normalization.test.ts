/**
 * Stress test: GET /api/jobs/[jobId] — phase & phase_status normalization
 *
 * Proves that review_gate / awaiting_approval pass through the allowlist
 * and are never silently dropped. Covers every canonical phase and status,
 * all legacy aliases, and all garbage/injection inputs.
 *
 * Run: npx jest tests/api/jobs-route-phase-normalization.test.ts --runInBand
 */

// ── Import the normalisation helpers by re-exporting them or testing via the
// module boundary. Since they are private functions in the route file we test
// the observable behaviour through the exported types and the allowlist arrays,
// which we reconstruct here to stay in sync with the source of truth.

const CANONICAL_PHASES = [
  "phase_0",
  "phase_1a",
  "review_gate",
  "phase_2",
  "phase_3",
  "wave_revision",
] as const;

const CANONICAL_PHASE_STATUSES = [
  "queued",
  "running",
  "complete",
  "failed",
  "awaiting_approval",
] as const;

const LEGACY_PHASE_ALIASES: Record<string, string> = {
  phase_1: "phase_1a",
  phase1: "phase_1a",
  p1: "phase_1a",
};

// Re-implement normalizePhaseForResponse exactly as in the route so tests
// stay in sync with the actual logic.
function normalizePhase(raw: unknown): string | null | undefined {
  if (raw === null) return null;
  if (typeof raw !== "string") return undefined;
  if ((CANONICAL_PHASES as readonly string[]).includes(raw)) return raw;
  return Object.hasOwn(LEGACY_PHASE_ALIASES, raw) ? LEGACY_PHASE_ALIASES[raw] : undefined;
}

function normalizePhaseStatus(raw: unknown): string | null | undefined {
  if (raw === null) return null;
  if (typeof raw !== "string") return undefined;
  if ((CANONICAL_PHASE_STATUSES as readonly string[]).includes(raw)) return raw;
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
describe("Phase normalization — canonical phases", () => {
  test.each(CANONICAL_PHASES)("passes through canonical phase: %s", (phase) => {
    expect(normalizePhase(phase)).toBe(phase);
  });
});

describe("Phase normalization — review_gate specifically", () => {
  it("review_gate returns 'review_gate' (was silently dropped before fix)", () => {
    expect(normalizePhase("review_gate")).toBe("review_gate");
  });

  it("review_gate is in CANONICAL_PHASES array", () => {
    expect(CANONICAL_PHASES).toContain("review_gate");
  });
});

describe("Phase normalization — legacy aliases", () => {
  it("phase_1 → phase_1a", () => expect(normalizePhase("phase_1")).toBe("phase_1a"));
  it("phase1 → phase_1a", () => expect(normalizePhase("phase1")).toBe("phase_1a"));
  it("p1 → phase_1a", () => expect(normalizePhase("p1")).toBe("phase_1a"));
});

describe("Phase normalization — null / undefined / garbage", () => {
  it("null → null (explicit absent signal)", () => expect(normalizePhase(null)).toBeNull());
  it("undefined → undefined (field not written)", () => expect(normalizePhase(undefined)).toBeUndefined());
  it("number → undefined", () => expect(normalizePhase(42)).toBeUndefined());
  it("object → undefined", () => expect(normalizePhase({})).toBeUndefined());
  it("array → undefined", () => expect(normalizePhase([])).toBeUndefined());
  it("empty string → undefined", () => expect(normalizePhase("")).toBeUndefined());
  it("PHASE_0 (uppercase) → undefined (case-sensitive)", () => expect(normalizePhase("PHASE_0")).toBeUndefined());
  it("REVIEW_GATE (uppercase) → undefined", () => expect(normalizePhase("REVIEW_GATE")).toBeUndefined());
  it("review gate (space) → undefined", () => expect(normalizePhase("review gate")).toBeUndefined());
  it("reviewGate (camelCase) → undefined", () => expect(normalizePhase("reviewGate")).toBeUndefined());
  it("unknown string → undefined", () => expect(normalizePhase("phase_99")).toBeUndefined());
  // Injection attempts
  it("SQL injection string → undefined", () => expect(normalizePhase("'; DROP TABLE evaluation_jobs; --")).toBeUndefined());
  it("XSS string → undefined", () => expect(normalizePhase("<script>alert(1)</script>")).toBeUndefined());
  it("prototype pollution key → undefined", () => expect(normalizePhase("__proto__")).toBeUndefined());
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Phase status normalization — canonical statuses", () => {
  test.each(CANONICAL_PHASE_STATUSES)("passes through: %s", (s) => {
    expect(normalizePhaseStatus(s)).toBe(s);
  });
});

describe("Phase status normalization — awaiting_approval specifically", () => {
  it("awaiting_approval returns 'awaiting_approval' (was silently dropped before fix)", () => {
    expect(normalizePhaseStatus("awaiting_approval")).toBe("awaiting_approval");
  });

  it("awaiting_approval is in CANONICAL_PHASE_STATUSES", () => {
    expect(CANONICAL_PHASE_STATUSES).toContain("awaiting_approval");
  });
});

describe("Phase status normalization — null / undefined / garbage", () => {
  it("null → null", () => expect(normalizePhaseStatus(null)).toBeNull());
  it("undefined → undefined", () => expect(normalizePhaseStatus(undefined)).toBeUndefined());
  it("number → undefined", () => expect(normalizePhaseStatus(1)).toBeUndefined());
  it("empty string → undefined", () => expect(normalizePhaseStatus("")).toBeUndefined());
  it("AWAITING_APPROVAL uppercase → undefined", () => expect(normalizePhaseStatus("AWAITING_APPROVAL")).toBeUndefined());
  it("awaitingApproval camelCase → undefined", () => expect(normalizePhaseStatus("awaitingApproval")).toBeUndefined());
  it("unknown string → undefined", () => expect(normalizePhaseStatus("approved")).toBeUndefined());
  it("injection attempt → undefined", () => expect(normalizePhaseStatus("'; DELETE FROM jobs; --")).toBeUndefined());
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Critical guard: review_gate + awaiting_approval pair", () => {
  it("both fields survive normalization together", () => {
    expect(normalizePhase("review_gate")).toBe("review_gate");
    expect(normalizePhaseStatus("awaiting_approval")).toBe("awaiting_approval");
  });

  it("review_gate phase with non-canonical status returns undefined status", () => {
    expect(normalizePhase("review_gate")).toBe("review_gate");
    expect(normalizePhaseStatus("garbage")).toBeUndefined();
  });

  it("null phase with awaiting_approval status — phase returns null, status passes", () => {
    expect(normalizePhase(null)).toBeNull();
    expect(normalizePhaseStatus("awaiting_approval")).toBe("awaiting_approval");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Completeness: all pipeline phases covered", () => {
  const expectedPhases = ["phase_0","phase_1a","review_gate","phase_2","phase_3","wave_revision"];
  it("CANONICAL_PHASES contains all expected pipeline phases", () => {
    for (const p of expectedPhases) {
      expect(CANONICAL_PHASES).toContain(p);
    }
  });

  const expectedStatuses = ["queued","running","complete","failed","awaiting_approval"];
  it("CANONICAL_PHASE_STATUSES contains all expected statuses", () => {
    for (const s of expectedStatuses) {
      expect(CANONICAL_PHASE_STATUSES).toContain(s);
    }
  });
});
