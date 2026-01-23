#!/usr/bin/env node
// Verify schema is properly deployed
// Tests: manuscript_chunks table, chunk_status enum, claim_chunk_for_processing RPC

import { createClient } from "@supabase/supabase-js";
import process from "process";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verifySchema() {
  console.log("=== Schema Verification ===\n");

  // 1. Check manuscript_chunks table exists
  console.log("1. Checking manuscript_chunks table...");
  const { data: tables, error: tableError } = await supabase.rpc(
    "get_tables",
    {},
    { head: false }
  );

  // Alternative: direct query to information_schema
  const { data: columns, error: colError } = await supabase
    .from("information_schema.columns")
    .select("*")
    .eq("table_name", "manuscript_chunks")
    .eq("table_schema", "public");

  if (colError) {
    // Try direct SQL query
    console.log("   Attempting direct query...");
    const { data, error } = await supabase.rpc("sql", {
      query: `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'manuscript_chunks'
        AND table_schema = 'public'
        ORDER BY ordinal_position;
      `,
    });

    if (error) {
      console.log("   ⚠️  Cannot query schema directly via RPC");
    } else if (data && data.length > 0) {
      console.log("   ✅ manuscript_chunks table exists with columns:");
      data.forEach((col) =>
        console.log(`      - ${col.column_name}: ${col.data_type}`)
      );
    }
  } else if (columns && columns.length > 0) {
    console.log("   ✅ manuscript_chunks table exists with columns:");
    const uniqueCols = {};
    columns.forEach((col) => {
      if (!uniqueCols[col.column_name]) {
        uniqueCols[col.column_name] = col.data_type;
      }
    });
    Object.entries(uniqueCols).forEach(([name, type]) => {
      console.log(`      - ${name}: ${type}`);
    });
  }

  // 2. Check chunk_status enum exists
  console.log("\n2. Checking chunk_status enum...");
  const { data: enumCheck, error: enumError } = await supabase.rpc(
    "execute_query",
    {
      query: `SELECT 1 FROM pg_type WHERE typname = 'chunk_status'`,
    }
  );

  if (!enumError && enumCheck) {
    console.log("   ✅ chunk_status enum exists");
  } else {
    console.log("   ⚠️  Cannot verify enum directly, checking via table creation");
  }

  // 3. Check claim_chunk_for_processing RPC exists
  console.log("\n3. Checking claim_chunk_for_processing RPC function...");
  try {
    // Try to call the function with a dummy UUID
    const { data, error } = await supabase.rpc(
      "claim_chunk_for_processing",
      { chunk_id: "00000000-0000-0000-0000-000000000000" }
    );

    if (error && error.code === "PGRST116") {
      console.log("   ✅ claim_chunk_for_processing RPC exists (returned false for non-existent chunk)");
    } else if (error && error.message.includes("function")) {
      console.log("   ❌ claim_chunk_for_processing RPC NOT FOUND");
      console.log(`      Error: ${error.message}`);
    } else if (typeof data === "boolean") {
      console.log("   ✅ claim_chunk_for_processing RPC exists (returned boolean)");
    }
  } catch (err) {
    console.log(`   ❌ Error calling RPC: ${err.message}`);
  }

  // 4. Check processing_started_at column
  console.log("\n4. Checking processing_started_at column...");
  const { data: psaCheck, error: psaError } = await supabase
    .from("information_schema.columns")
    .select("*")
    .eq("table_name", "manuscript_chunks")
    .eq("column_name", "processing_started_at")
    .eq("table_schema", "public");

  if (psaError || !psaCheck || psaCheck.length === 0) {
    console.log("   ❌ processing_started_at column NOT FOUND");
  } else {
    console.log(
      `   ✅ processing_started_at column exists (type: ${psaCheck[0].data_type})`
    );
  }

  // 5. Check attempt_count column
  console.log("\n5. Checking attempt_count column...");
  const { data: acCheck, error: acError } = await supabase
    .from("information_schema.columns")
    .select("*")
    .eq("table_name", "manuscript_chunks")
    .eq("column_name", "attempt_count")
    .eq("table_schema", "public");

  if (acError || !acCheck || acCheck.length === 0) {
    console.log("   ❌ attempt_count column NOT FOUND");
  } else {
    console.log(`   ✅ attempt_count column exists`);
  }

  console.log("\n=== Schema Verification Complete ===");
}

verifySchema().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
