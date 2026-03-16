import { getSupabaseAdminClient } from "@/lib/supabase";

type HydrationStats = {
  scanned: number;
  hydrated: number;
  skipped: number;
  failed: number;
};

type HydrationOptions = {
  limit?: number;
};

let _supabase: ReturnType<typeof getSupabaseAdminClient> | undefined;

function getSupabase() {
  if (_supabase === undefined) {
    _supabase = getSupabaseAdminClient();
  }
  return _supabase;
}

const supabase = new Proxy({} as NonNullable<ReturnType<typeof getSupabaseAdminClient>>, {
  get(_target, prop) {
    const client = getSupabase();
    if (!client) {
      throw new Error(
        `[MANUSCRIPT-VERSION-HYDRATION] Supabase unavailable - cannot access .${String(prop)}`,
      );
    }
    return client[prop as keyof typeof client];
  },
});

function decodeDataUrl(fileUrl: string): string | null {
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

async function resolveTextFromFileUrl(fileUrl: string): Promise<string | null> {
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

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Hydrate v1 manuscript_versions rows where raw_text is still empty.
 *
 * Note: This avoids placeholder text; rows without resolvable text are skipped.
 */
export async function hydrateMissingRawTextForV1(
  options: HydrationOptions = {},
): Promise<HydrationStats> {
  const limit = options.limit ?? 200;

  const { data, error } = await supabase
    .from("manuscript_versions")
    .select("id, manuscript_id, version_number, raw_text, manuscripts(file_url)")
    .eq("version_number", 1)
    .eq("raw_text", "")
    .limit(limit);

  if (error) {
    throw new Error(`Failed to query rows for hydration: ${error.message}`);
  }

  const rows = (data ?? []) as any[];
  const stats: HydrationStats = {
    scanned: rows.length,
    hydrated: 0,
    skipped: 0,
    failed: 0,
  };

  for (const row of rows) {
    try {
      const manuscript = Array.isArray(row.manuscripts) ? row.manuscripts[0] : row.manuscripts;
      const fileUrl = manuscript?.file_url as string | undefined;

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
    } catch (e) {
      console.error(
        `[MANUSCRIPT-VERSION-HYDRATION] Failed for version_id=${row.id}:`,
        e instanceof Error ? e.message : String(e),
      );
      stats.failed += 1;
    }
  }

  return stats;
}
