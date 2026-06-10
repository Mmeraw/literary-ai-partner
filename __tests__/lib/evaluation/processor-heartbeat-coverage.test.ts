export {};

const fs = require("fs");
const path = require("path");

/**
 * CI-enforced invariant: no production processor path may exist without
 * worker_pulse_at heartbeat coverage.
 *
 * The watchdog has a 20-second idle-pulse threshold. Any silent gap longer
 * than that will cause a legitimate worker to be killed. These tests ensure
 * that no-op heartbeat callbacks and uncovered long-running paths cannot be
 * reintroduced without breaking CI.
 *
 * Background: PRs #1071, #1072 fixed crash loops caused by no-op heartbeat
 * callbacks and uncovered Phase 2/3 entry paths. This test converts those
 * fixes into a permanent regression guard.
 */
describe("processor heartbeat coverage invariants", () => {
  const repoRoot = path.resolve(__dirname, "../../..");
  const processorPath = path.join(repoRoot, "lib/evaluation/processor.ts");

  let processorCode: string;

  beforeAll(() => {
    processorCode = fs.readFileSync(processorPath, "utf8");
  });

  // ── No-op heartbeat ban ─────────────────────────────────────────────

  test("no production path passes a no-op _onChunkHeartbeat callback", () => {
    // Empty arrow: () => {}
    const emptyArrow = /_onChunkHeartbeat:\s*\(\)\s*=>\s*\{\s*\}/g;
    const emptyMatches = processorCode.match(emptyArrow);
    expect(emptyMatches).toBeNull();
  });

  test("no production path passes a commented-out no-op heartbeat", () => {
    // Arrow with only a comment inside: () => { /* ... */ }
    const commentOnly = /_onChunkHeartbeat:\s*\(\)\s*=>\s*\{\s*\/\*[^}]*\*\/\s*\}/g;
    const commentMatches = processorCode.match(commentOnly);
    expect(commentMatches).toBeNull();
  });

  test("no 'watchdog pulse' comment markers remain in processor", () => {
    expect(processorCode).not.toContain("watchdog pulse");
  });

  test("no 'noop heartbeat' markers remain in processor outside pulseWorker doc", () => {
    // The pulseWorker definition comment legitimately references "no-op heartbeat"
    // to document what it replaces. Strip that single comment, then assert no
    // other references exist.
    const withoutPulseWorkerDoc = processorCode
      .replace("// replaces all ad-hoc and no-op heartbeat callbacks.", "");
    expect(withoutPulseWorkerDoc.toLowerCase()).not.toContain("no-op heartbeat");
    expect(withoutPulseWorkerDoc.toLowerCase()).not.toContain("noop heartbeat");
  });

  // ── Centralized pulseWorker existence ───────────────────────────────

  test("centralized pulseWorker function is defined in processor", () => {
    expect(processorCode).toContain("const pulseWorker = (label: string)");
  });

  test("pulseWorker writes worker_pulse_at to evaluation_jobs", () => {
    // Extract the pulseWorker function body (from definition to next closing brace pattern)
    const pulseWorkerMatch = processorCode.match(
      /const pulseWorker = \(label: string\)[\s\S]*?worker_pulse_at/
    );
    expect(pulseWorkerMatch).not.toBeNull();
  });

  // ── Phase 2 heartbeat coverage ──────────────────────────────────────

  test("Phase 2 entry has heartbeat stamp before setup work", () => {
    expect(processorCode).toContain("pulseWorker('phase2/entry')");
  });

  test("Phase 2 has heartbeat after stabilize", () => {
    expect(processorCode).toContain("pulseWorker('phase2/after-stabilize')");
  });

  test("Phase 2 has heartbeat before governance gate", () => {
    expect(processorCode).toContain("pulseWorker('phase2/before-governance-gate')");
  });

  test("Phase 2 has heartbeat after governance gate", () => {
    expect(processorCode).toContain("pulseWorker('phase2/after-governance-gate')");
  });

  test("Phase 2 has heartbeat before chunk cache load", () => {
    expect(processorCode).toContain("pulseWorker('phase2/before-chunk-cache-load')");
  });

  test("Phase 2 has heartbeat before chunk processing", () => {
    expect(processorCode).toContain("pulseWorker('phase2/before-chunk-processing')");
  });

  test("Phase 2 chunk callback uses centralized pulseWorker", () => {
    expect(processorCode).toContain("pulseWorker('phase2/chunk-heartbeat')");
  });

  test("Phase 2 has heartbeat before handoff read", () => {
    expect(processorCode).toContain("pulseWorker('phase2/before-handoff-read')");
  });

  // ── Phase 3 heartbeat coverage ──────────────────────────────────────

  test("Phase 3 entry has heartbeat stamp", () => {
    expect(processorCode).toContain("pulseWorker('phase3/entry')");
  });

  test("Phase 3 has heartbeat before governance gate", () => {
    expect(processorCode).toContain("pulseWorker('phase3/before-governance-gate')");
  });

  test("Phase 3 has heartbeat after governance gate", () => {
    expect(processorCode).toContain("pulseWorker('phase3/after-governance-gate')");
  });

  test("Phase 3 has heartbeat before synthesis", () => {
    expect(processorCode).toContain("pulseWorker('phase3/before-pass3b-synthesis')");
  });

  test("Phase 3 has heartbeat before handoff read", () => {
    expect(processorCode).toContain("pulseWorker('phase3/before-handoff-read')");
  });

  test("Phase 3 has heartbeat before ledger read", () => {
    expect(processorCode).toContain("pulseWorker('phase3/before-ledger-read')");
  });

  test("Phase 3 has heartbeat before preflight read", () => {
    expect(processorCode).toContain("pulseWorker('phase3/before-preflight-read')");
  });

  test("Phase 3 has heartbeat before pipeline run", () => {
    expect(processorCode).toContain("pulseWorker('phase3/before-pipeline-run')");
  });

  // ── Persistence path coverage ───────────────────────────────────────

  test("persistence path has heartbeat before artifact writes", () => {
    // The persistence lock replaces the old pulseWorker call — it sets
    // worker_pulse_at to a future timestamp, structurally preventing
    // watchdog from killing the job mid-persistence.
    expect(processorCode).toContain("declarePersistenceLock('persistence/lock-acquired')");
  });

  // ── Phase 1A heartbeat coverage ─────────────────────────────────────

  test("Phase 1A track-c paths use centralized pulseWorker", () => {
    expect(processorCode).toContain("pulseWorker('phase1a/track-c-parallel')");
    expect(processorCode).toContain("pulseWorker('phase1a/track-c-race')");
    expect(processorCode).toContain("pulseWorker('phase1a/track-c-standalone')");
  });

  // ── Minimum coverage count ──────────────────────────────────────────

  test("processor has at least 25 pulseWorker stamp points", () => {
    const pulseWorkerCalls = processorCode.match(/pulseWorker\(/g);
    // Current count is 28 (1 definition + 27 call sites).
    // The definition itself contains pulseWorker( so we count all occurrences.
    expect(pulseWorkerCalls).not.toBeNull();
    expect(pulseWorkerCalls!.length).toBeGreaterThanOrEqual(25);
  });

  // ── All _onChunkHeartbeat callbacks must reference pulseWorker ──────

  test("every _onChunkHeartbeat callback invokes pulseWorker or a real DB write", () => {
    // Find all _onChunkHeartbeat callback assignments
    const callbackPattern = /_onChunkHeartbeat:\s*\(\)\s*=>\s*[^,}]+/g;
    const callbacks = processorCode.match(callbackPattern) || [];

    for (const cb of callbacks) {
      // Each callback must either call pulseWorker or write worker_pulse_at
      const hasPulseWorker = cb.includes("pulseWorker");
      const hasDbWrite = cb.includes("worker_pulse_at");
      expect(
        hasPulseWorker || hasDbWrite,
      ).toBe(true);
    }
  });
});
