import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflowPaths = [
  ".github/workflows/latency-pr-enforcement.yml",
  ".github/workflows/pr-head-freshness-guard.yml",
];

for (const workflowPath of workflowPaths) {
  test(`${workflowPath} retries transient GitHub API failures`, () => {
    const source = readFileSync(workflowPath, "utf8");
    const githubScriptSteps = source.match(/uses: actions\/github-script@v7/g) ?? [];
    const boundedRetries = source.match(/^\s+retries: 3$/gm) ?? [];

    assert.ok(githubScriptSteps.length > 0, "expected at least one github-script step");
    assert.equal(
      boundedRetries.length,
      githubScriptSteps.length,
      "every github-script step must retain bounded retries for transient 5xx responses",
    );
  });
}
