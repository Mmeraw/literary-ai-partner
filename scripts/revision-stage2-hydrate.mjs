#!/usr/bin/env node
/**
 * Stage 2 manuscript version hydration
 *
 * Populates v1 `manuscript_versions.raw_text` from `manuscripts.file_url`
 * for rows that were backfilled with empty text during Stage 2 foundation setup.
 *
 * Required env:
 *   SUPABASE_SERVICE_ROLE_KEY=<key>
 *   SUPABASE_URL=<url> or NEXT_PUBLIC_SUPABASE_URL=<url>
 * Optional env:
 *   HYDRATE_LIMIT=<n> (default 200)
 */

import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./load-env.mjs";

loadLocalEnv();

function env(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing env ${name}. Define it in .env/.env.local or export it in your shell.`,
    );
  }
  return value;
}

function decodeDataUrl(fileUrl) {
  const base64Match = fileUrl.match(/^data:[^,]*;base64,(.*)$/);
  if (base64Match) {
    return Buffer.from(base64Match[1], "base64").toString("utf8");
  }

  const encodedMatch = fileUrl.match(/^data:[^,]*,(.*)$/);
  if (encodedMatch) {
    return decodeURIComponent(encodedMatch[1]);
  }

  return null;
}

async function resolveTextFromFileUrl(fileUrl) {
  if (!fileUrl) return null;

  if (fileUrl.startsWith("data:")) {
    return decodeDataUrl(fileUrl);
  }

  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.text();
}

function countWords(text) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL || env("NEXT_PUBLIC_SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
  const limit = Number(process.env.HYDRATE_LIMIT ?? 200);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("manuscript_versions")
    .select("id, manuscript_id, version_number, raw_text, manuscripts(file_url)")
    .eq("version_number", 1)
    .eq("raw_text", "")
    .limit(limit);

  if (error) {
    throw new Error(`Failed to query rows for hydration: ${error.message}`);
  }

  const rows = data ?? [];
  const stats = {
    scanned: rows.length,
    hydrated: 0,
    skipped: 0,
    failed: 0,
  };

  for (const row of rows) {
    try {
      const manuscript = Array.isArray(row.manuscripts) ? row.manuscripts[0] : row.manuscripts;
      const fileUrl = manuscript?.file_url;

      if (!fileUrl) {
        stats.skipped += 1;
        continue;
      }

      const resolvedText = await resolveTextFromFileUrl(fileUrl);
      if (!resolvedText || resolvedText.trim().length === 0) {
        stats.skipped += 1;
        continue;
      }

      const normalized = resolvedText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

      const { error: updateError } = await supabase
        .from("manuscript_versions")
        .update({
          raw_text: normalized,
          word_count: countWords(normalized),
        })
        .eq("id", row.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      stats.hydrated += 1;
    } catch (error) {
      console.error(
        `[STAGE2-HYDRATE] Failed for version_id=${row.id}:`,
        error instanceof Error ? error.message : String(error),
      );
      stats.failed += 1;
    }
  }

  console.log("✅ Stage 2 hydration completed");
  console.log(JSON.stringify(stats, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
