#!/usr/bin/env node

/**
 * CI DB Migration Check
 * 
 * Validates that critical migrations are applied to the CI Supabase instance.
 * FAILS HARD if required migrations are missing (DB drift).
 * 
 * This is a proof gate, not a convenience check.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Required migrations for A5 admin retry atomicity proof
 */
const REQUIRED_MIGRATIONS = [
  {
    id: "20260131000000_admin_retry_job_atomic_rpc",
    description: "admin_retry_job RPC with atomic guarantees",
    checkFn: async () => {
      // Try to call the RPC with a test job ID
      // Expected: returns 1 row with (job_id, status, changed) shape
      const testJobId = "00000000-0000-0000-0000-000000000000";
      const { data, error } = await supabase.rpc("admin_retry_job", {
        p_job_id: testJobId,
      });

      if (error) {
        if (error.message && error.message.includes("does not exist")) {
          return {
            applied: false,
            reason: "RPC does not exist",
            error: error.message,
          };
        }
        return {
          applied: false,
          reason: "RPC call failed",
          error: error.message,
        };
      }

      // Validate shape and behavior
      if (!Array.isArray(data)) {
        return {
          applied: false,
          reason: `RPC returned non-array: ${typeof data}`,
        };
      }

      if (data.length !== 1) {
        return {
          applied: false,
          reason: `RPC returned ${data.length} rows (expected 1). Missing 'right join (select 1) one on true' pattern.`,
        };
      }

      const result = data[0];
      if (
        !result.hasOwnProperty("job_id") ||
        !result.hasOwnProperty("status") ||
        !result.hasOwnProperty("changed")
      ) {
        return {
          applied: false,
          reason: `RPC returned wrong shape. Got keys: ${Object.keys(result).join(", ")}`,
        };
      }

      if (result.changed !== false) {
        return {
          applied: false,
          reason: `RPC returned changed=${result.changed} for non-existent job (expected false)`,
        };
      }

      return {
        applied: true,
        reason: "RPC exists with correct signature and behavior",
      };
    },
  },
];

async function main() {
  console.log("════════════════════════════════════════════════════════");
  console.log("  CI DB Migration Check");
  console.log("  Timestamp:", new Date().toISOString());
  console.log("  Supabase URL:", SUPABASE_URL);
  console.log("════════════════════════════════════════════════════════");

  let allApplied = true;
  const results = [];

  for (const migration of REQUIRED_MIGRATIONS) {
    console.log(`\n[CHECK] ${migration.id}`);
    console.log(`  Description: ${migration.description}`);

    try {
      const result = await migration.checkFn();
      results.push({ migration, result });

      if (result.applied) {
        console.log(`  ✅ APPLIED: ${result.reason}`);
      } else {
        console.log(`  ❌ NOT APPLIED: ${result.reason}`);
        if (result.error) {
          console.log(`     Error: ${result.error}`);
        }
        allApplied = false;
      }
    } catch (err) {
      console.log(`  ❌ CHECK FAILED: ${err.message}`);
      results.push({
        migration,
        result: { applied: false, reason: err.message },
      });
      allApplied = false;
    }
  }

  console.log("\n════════════════════════════════════════════════════════");

  if (allApplied) {
    console.log("  ✅ ALL REQUIRED MIGRATIONS APPLIED");
    console.log("  CI DB is in sync with repo migrations.");
    console.log("════════════════════════════════════════════════════════\n");
    process.exitCode = 0;
  } else {
    console.log("  ❌ CI DB DRIFT DETECTED");
    console.log("\n  The following migrations are missing or incorrect:");
    results
      .filter((r) => !r.result.applied)
      .forEach((r) => {
        console.log(`    • ${r.migration.id}`);
        console.log(`      ${r.result.reason}`);
      });

    console.log("\n  Resolution:");
    console.log("    1. Apply missing migrations to CI Supabase instance, OR");
    console.log("    2. Add migration apply step to CI workflow");
    console.log("\n  Proof gate BLOCKED until migrations are applied.");
    console.log("════════════════════════════════════════════════════════\n");
    process.exitCode = 1;
  }

  // Flush logs
  setImmediate(() => {
    process.exit(process.exitCode);
  });
}

main();
