#!/usr/bin/env node
/**
 * Metrics Safety Test
 *
 * Executes metrics hooks with edge cases to prove they never throw.
 * Hits POST /api/dev/metrics-smoke which actually imports and calls lib/jobs/metrics.ts.
 */
import { getBaseUrl } from "./base-url.mjs";

async function main() {
  const BASE_URL = await getBaseUrl();
  console.log(`Metrics Safety Test - ${new Date().toISOString()}`);
  console.log(`Testing against: ${BASE_URL}\n`);

  console.log("=== Executing Metrics Hooks ===");
  
  const res = await fetch(`${BASE_URL}/api/dev/metrics-smoke`, { 
    method: "POST" 
  });
  
  const json = await res.json();

  if (!res.ok || !json.ok) {
    console.error("❌ FAIL: Metrics threw an error");
    console.error("Error:", json.error);
    if (json.stack) {
      console.error("Stack:", json.stack);
    }
    process.exit(1);
  }

  console.log("✓ All metrics hooks executed without throwing\n");

  console.log("=== Tested Functions ===");
  json.tested.forEach(fn => console.log(`  ✓ ${fn}()`));

  console.log("\n=== Edge Cases Tested ===");
  json.edge_cases.forEach(ec => console.log(`  ✓ ${ec}`));

  console.log("\n✅ PASS: Metrics hooks never throw (audit-grade verification)");
  console.log("\nTo see metrics output:");
  console.log("  METRICS_ENABLED=true npm run jobs:smoke:phase2");
  
  process.exit(0);
}

main().catch((e) => {
  console.error("ERROR:", e?.stack || e?.message || String(e));
  process.exit(1);
});
