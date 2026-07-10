import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("artifacts synthesis_status + poller stop contract", () => {
  test("artifacts API exposes synthesis_status and reports skipped when worker disabled", () => {
    const source = read("app/api/jobs/[jobId]/artifacts/route.ts");
    expect(source).toContain("type SynthesisStatus = \"pending\" | \"complete\" | \"skipped\" | \"failed\"");
    expect(source).toContain("DREAM_WORKER_ENABLED");
    expect(source).toContain("synthesis_status: synthesisStatus");
    expect(source).toContain("artifact: hasLongformDocument ? artifact : null");
    expect(source).toContain("/\\[DreamWorker\\]|preflight:/i.test(job.last_error)");
  });

  test("process-dream worker has exactly one DREAM_WORKER_ENABLED guard with ok:true response", () => {
    const source = read("app/api/workers/process-dream/route.ts");
    // Single guard — not duplicated
    const guardMatches = source.match(/process\.env\.DREAM_WORKER_ENABLED\s*===\s*['"]false['"]/g) ?? [];
    expect(guardMatches).toHaveLength(1);
    // Canonical response is ok:true with a trace_id
    expect(source).toContain("ok: true, skipped: true, reason: 'DREAM_WORKER_DISABLED', trace_id:");
    // Must NOT have the old ok:false variant
    expect(source).not.toContain("ok: false, skipped: true, reason: 'DREAM_WORKER_DISABLED'");
  });

  test("SynthesisPoller terminal copy does not promise automatic behavior polling has stopped", () => {
    const source = read("components/evaluation/SynthesisPoller.tsx");
    expect(source).toContain("data.synthesis_status ?? \"pending\"");
    expect(source).toContain("synthesisStatus === \"skipped\" || synthesisStatus === \"failed\"");
    // Must NOT make false promises once polling has stopped
    expect(source).not.toContain("Narrative Synthesis was not generated");
    expect(source).not.toContain("This will be completed automatically");
    expect(source).not.toContain("We are automatically retrying");
    // Must show neutral message with explicit retry action
    expect(source).toContain("temporarily unavailable");
    expect(source).toContain("Use the button below");
  });
});
