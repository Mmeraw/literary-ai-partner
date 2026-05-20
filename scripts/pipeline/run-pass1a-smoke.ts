/**
 * Pass 1A Smoke Test — Standalone
 *
 * Pulls 3 chunks from the specified job's manuscript_chunks,
 * runs Pass 1A sweep in isolation, dumps ledger output to artifacts/.
 *
 * Usage:
 *   npx tsx -r tsconfig-paths/register scripts/pipeline/run-pass1a-smoke.ts \
 *     --job-id=24f81c04-7016-4b43-a02d-87899856a193 \
 *     --chunks=3
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config as loadDotenv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { runPass1a } from "@/lib/evaluation/pipeline/runPass1a";
import { reduceCharacterEvidence, buildCharacterLedgerV2 } from "@/lib/evaluation/pipeline/characterReducer";
import type { ManuscriptChunkEvidence } from "@/lib/evaluation/pipeline/types";

// ── Env loading ──
const envPath = join(process.cwd(), ".env.local");
const envFallback = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  loadDotenv({ path: envPath });
} else if (existsSync(envFallback)) {
  loadDotenv({ path: envFallback });
}

// ── Args ──
function getArg(name: string, fallback?: string): string | undefined {
  const prefix = `--${name}=`;
  const argv = process.argv.slice(2);
  const eq = argv.find((a) => a.startsWith(prefix));
  if (eq) return eq.slice(prefix.length);
  const idx = argv.indexOf(`--${name}`);
  if (idx !== -1 && idx + 1 < argv.length) return argv[idx + 1];
  return fallback;
}

const JOB_ID = getArg("job-id", "24f81c04-7016-4b43-a02d-87899856a193")!;
const CHUNK_LIMIT = Math.max(1, parseInt(getArg("chunks", "3") ?? "3", 10));

async function main() {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) throw new Error("OPENAI_API_KEY is required");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error("Supabase credentials required (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)");

  const supabase = createClient(supabaseUrl, supabaseKey);

  // ── Fetch chunks ──
  console.log(`[Smoke] Fetching ${CHUNK_LIMIT} chunks for job ${JOB_ID}...`);
  const { data: rows, error } = await supabase
    .from("manuscript_chunks")
    .select("chunk_index, content")
    .eq("job_id", JOB_ID)
    .order("chunk_index", { ascending: true })
    .limit(CHUNK_LIMIT);

  if (error) throw new Error(`Supabase fetch failed: ${error.message}`);
  if (!rows || rows.length === 0) throw new Error("No chunks found for job — check job_id");

  const manuscriptChunks: ManuscriptChunkEvidence[] = rows.map((r) => ({
    chunk_index: r.chunk_index as number,
    content: r.content as string,
  }));

  console.log(`[Smoke] Loaded ${manuscriptChunks.length} chunks. Sizes: ${manuscriptChunks.map(c => `${c.chunk_index}:${c.content.length}ch`).join(", ")}`);

  // ── Run Pass 1A ──
  console.log("[Smoke] Starting Pass 1A sweep...");
  const t0 = Date.now();
  const result = await runPass1a({
    manuscriptText: manuscriptChunks.map(c => c.content).join("\n\n"),
    manuscriptChunks,
    title: "Cartel Babies (smoke test)",
    workType: "novel",
    openaiApiKey,
    jobId: `smoke-${JOB_ID.slice(0, 8)}`,
  });

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\n[Smoke] ✅ Pass 1A complete in ${elapsed}s`);
  console.log(`  total_chunks:      ${result.total_chunks}`);
  console.log(`  successful_chunks: ${result.successful_chunks}`);
  console.log(`  failed_chunks:     ${result.failedChunkIndices.length} → [${result.failedChunkIndices.join(", ")}]`);
  console.log(`  model:             ${result.model}`);
  console.log(`  prompt_version:    ${result.prompt_version}`);

  if (result.chunkOutputs.length === 0) {
    console.error("\n[Smoke] ❌ LEDGER_EMPTY — zero chunk outputs. Pass 1A is broken.");
    process.exit(1);
  }

  // ── Build ledgers ──
  const characterLedger = reduceCharacterEvidence({
    chunkOutputs: result.chunkOutputs,
    jobId: `smoke-${JOB_ID.slice(0, 8)}`,
    totalChunksInManuscript: manuscriptChunks.length,
  });

  const characterLedgerV2 = buildCharacterLedgerV2({
    ledger: characterLedger,
    chunkOutputs: result.chunkOutputs,
    jobId: `smoke-${JOB_ID.slice(0, 8)}`,
    totalChunksInManuscript: manuscriptChunks.length,
  });

  console.log(`\n[Smoke] 📒 Ledger V1`);
  console.log(`  entries:             ${characterLedger.entries.length}`);
  console.log(`  protagonists:        ${characterLedger.coverage_summary.protagonists}`);
  console.log(`  co_protagonists:     ${characterLedger.coverage_summary.co_protagonists}`);
  console.log(`  symbol_payoff_items: ${characterLedger.coverage_summary.symbol_payoff_items.length}`);
  console.log(`  hard_fail_triggers:  ${characterLedger.coverage_summary.hard_fail_triggers.length}`);

  console.log(`\n[Smoke] 📒 Ledger V2`);
  console.log(`  active_blockers:     ${characterLedgerV2.activeBlockers.length}`);
  console.log(`  relationship_pairs:  ${characterLedgerV2.relationshipLedger.length}`);
  console.log(`  objects_tracked:     ${characterLedgerV2.objectLedger.length}`);
  console.log(`  character_coverage:  ${Object.keys(characterLedgerV2.characterCoverage).length} characters`);

  // ── Dump to file ──
  const outDir = join(process.cwd(), "artifacts", "smoke-pass1a");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${JOB_ID.slice(0, 8)}-${Date.now()}.json`);
  writeFileSync(outPath, JSON.stringify({
    smoke_run: {
      job_id: JOB_ID,
      chunks_tested: manuscriptChunks.length,
      elapsed_sec: parseFloat(elapsed),
      model: result.model,
      prompt_version: result.prompt_version,
    },
    pass1a_result: result,
    characterLedger,
    characterLedgerV2,
  }, null, 2));

  console.log(`\n[Smoke] Output saved → ${outPath}`);
  console.log("[Smoke] Pass 1A SMOKE TEST PASSED ✅");
}

main().catch((err) => {
  console.error("[Smoke] FATAL:", err);
  process.exit(1);
});
