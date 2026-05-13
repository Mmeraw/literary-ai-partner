// Pure classifier function mirroring the logic in
// .github/workflows/latency-pr-enforcement.yml (the `Classify PR by diff`
// step). Exported as a pure function so it can be unit-tested without
// GitHub API calls. If you change one, change the other; the test in
// classifier.test.mjs guards the contract.

export const VALID_TYPES = ["evaluation", "ui", "infra", "docs", "migration", "code"];

export const EVAL_PREFIXES = [
  "lib/evaluation/",
  "lib/pipeline/",
  "lib/canon/",
  "lib/governance/",
  "lib/invariants/",
  "lib/observability/",
  "lib/monitoring/",
  "lib/reliability/",
  "lib/manuscripts/",
  "lib/llm/",
  "lib/jobs/",
  "lib/release/",
  "lib/artifacts/",
  "lib/config/",
  "app/api/workers/",
  "app/api/evaluations/",
  "app/api/evaluate/",
  "app/api/jobs/",
  "app/api/manuscripts/",
  "tests/canon/",
  "tests/evaluation/",
  "tests/sipoc/",
  "tests/replays/",
  "tests/anchors/",
  "tests/failures/",
  "tests/fixtures/",
  "tests/protected/",
  "tests/jobs/",
  "tests/lib/evaluation/",
  "tests/lib/jobs/",
  "__tests__/",
  "workers/",
  "schemas/",
  "types/",
  "fixtures/",
  "testdata/",
  "calibration/",
  "evidence/",
  "artifacts/",
  "protected/",
  "prompts/",
];

export const UI_PREFIXES = [
  "app/admin/",
  "app/dashboard/",
  "app/evaluate/",
  "app/login/",
  "app/signup/",
  "app/output/",
  "app/reports/",
  "app/revise/",
  "app/share/",
  "app/pricing/",
  "app/marketing-preview/",
  "app/private-beta/",
  "app/resources/",
  "app/storygate/",
  "app/convert/",
  "app/your-writing/",
  "components/",
  "public/",
  "lib/ui/",
  "lib/hooks/",
];

export const UI_EXACT = new Set([
  "app/page.tsx",
  "app/page.jsx",
  "app/layout.tsx",
  "app/layout.jsx",
  "app/globals.css",
  "app/robots.txt",
]);

export const CODE_PREFIXES = [
  "lib/auth/",
  "lib/db/",
  "lib/admin/",
  "lib/security/",
  "lib/operations/",
  "lib/activity/",
  "lib/errors/",
  "lib/supabase/",
  "lib/revision/",
  "lib/reportShares/",
  "src/",
  "entities/",
  "base44/",
  "app/api/auth/",
  "app/api/admin/",
  "app/api/activity/",
  "app/api/report-shares/",
  "app/api/user/",
];

export const CODE_EXACT = new Set([
  "lib/audit.js",
  "lib/governance.js",
  "lib/supabase.js",
  "lib/rateLimit.ts",
]);

export const INFRA_PREFIXES = [
  ".github/",
  ".vscode/",
  ".githooks/",
  "scripts/",
  "ops/",
  "tests/stress/",
  "tests/playwright/",
  "tests/ui/",
  "tests/scripts/",
  "tests/test-helpers/",
  "tests/config/",
];

export const INFRA_EXACT = new Set([
  "vercel.json",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "tsconfig.json",
  "tsconfig.base.json",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "eslint.config.js",
  "eslint.config.mjs",
  "tailwind.config.js",
  "tailwind.config.ts",
  "postcss.config.js",
  "postcss.config.mjs",
  "lighthouserc.yml",
  "Dockerfile",
  "Makefile",
  ".npmrc",
  ".nvmrc",
]);

export const DOCS_PREFIXES = ["docs/", "archive/"];
export const MIGRATION_PREFIXES = ["supabase/migrations/"];

const matchesAny = (name, prefixes) => prefixes.some((p) => name.startsWith(p));

const isEval = (n) => matchesAny(n, EVAL_PREFIXES);
const isUi = (n) => matchesAny(n, UI_PREFIXES) || UI_EXACT.has(n);
const isCode = (n) => matchesAny(n, CODE_PREFIXES) || CODE_EXACT.has(n);
const isInfra = (n) => matchesAny(n, INFRA_PREFIXES) || INFRA_EXACT.has(n);
const isDocs = (n) =>
  matchesAny(n, DOCS_PREFIXES) ||
  (!n.includes("/") && n.toLowerCase().endsWith(".md"));
const isMigration = (n) => matchesAny(n, MIGRATION_PREFIXES);

// classify(files, labels) -> { type, buckets }
// - files: array of changed-file paths (strings).
// - labels: array of label names (strings). If any label of the form
//   `pr-type:<type>` is present with a valid type, that type wins.
export function classify(files, labels = []) {
  const labelOverride = labels
    .map((l) => String(l))
    .find((name) => name.startsWith("pr-type:"));
  if (labelOverride) {
    const overrideType = labelOverride.replace("pr-type:", "").trim();
    if (VALID_TYPES.includes(overrideType)) {
      return { type: overrideType, buckets: overrideType };
    }
  }

  const changed = files;
  const anyEval = changed.some(isEval);
  if (anyEval) {
    return { type: "evaluation", buckets: "" };
  }

  const buckets = new Set();
  for (const n of changed) {
    if (isUi(n)) buckets.add("ui");
    else if (isInfra(n)) buckets.add("infra");
    else if (isDocs(n)) buckets.add("docs");
    else if (isMigration(n)) buckets.add("migration");
    else if (isCode(n)) buckets.add("code");
    else buckets.add("unclassified");
  }

  if (buckets.has("unclassified")) {
    return { type: "evaluation", buckets: "" };
  } else if (buckets.size === 1) {
    return { type: [...buckets][0], buckets: "" };
  } else {
    return { type: "mixed", buckets: [...buckets].sort().join(",") };
  }
}
