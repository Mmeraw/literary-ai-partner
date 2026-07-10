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

  test("process-dream worker has its own DREAM_WORKER_ENABLED guard that exits before synthesis", () => {
    const source = read("app/api/workers/process-dream/route.ts");
    expect(source).toContain("DREAM_WORKER_ENABLED");
    expect(source).toContain("DREAM_WORKER_DISABLED");
  });

  test("SynthesisPoller stops on skipped status and renders neutral holding message, not 'not generated'", () => {
    const source = read("components/evaluation/SynthesisPoller.tsx");
    expect(source).toContain("data.synthesis_status ?? \"pending\"");
    expect(source).toContain("synthesisStatus === \"skipped\" || synthesisStatus === \"failed\"");
    // Must NOT tell a paying customer synthesis was "not generated"
    expect(source).not.toContain("Narrative Synthesis was not generated");
    // Must show a neutral holding message for skipped state
    expect(source).toContain("temporarily unavailable");
    // Failed state must offer retry and explain the problem
    expect(source).toContain("Narrative Synthesis encountered a problem");
  });
});
