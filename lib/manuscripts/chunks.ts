// lib/manuscripts/chunks.ts
// Database operations for manuscript chunks

import { getSupabaseAdminClient } from "@/lib/supabase";
import { randomUUID } from "crypto";
import { chunkManuscript, ChunkSpec } from "./chunking";

// Lazy-initialized admin client - returns null when credentials missing
let _supabase: ReturnType<typeof getSupabaseAdminClient> | undefined;

/**
 * Get Supabase client (lazy-initialized, null-safe for CI/build environments)
 * PRODUCTION CRITICAL: Returns null when Supabase unavailable
 */
function getSupabase() {
  if (_supabase === undefined) {
    _supabase = getSupabaseAdminClient();
  }
  return _supabase;
}

// Module-level accessor that throws meaningful errors when Supabase required but unavailable
const supabase = new Proxy({} as NonNullable<ReturnType<typeof getSupabaseAdminClient>>, {
  get(_target, prop) {
    const client = getSupabase();
    if (!client) {
      throw new Error(`[MANUSCRIPT-CHUNKS] Supabase unavailable - cannot access .${String(prop)}`);
    }
    return client[prop as keyof typeof client];
  }
});

export type ChunkRow = {
  id: string;
  manuscript_id: number;
  chunk_index: number;
  char_start: number;
  char_end: number;
  overlap_chars: number;
  label: string | null;
  content: string;
  content_hash: string;
  status: "pending" | "processing" | "done" | "failed";
  error: string | null;
  last_error: string | null;
  attempt_count: number;

  // Lease/claim tracking (present in schema + RPC contract)
  lease_id: string | null;
  lease_expires_at: string | null;

  processing_started_at: string | null;
  result_json: any | null;
  created_at: string;
  updated_at: string;

  // Optional retry ceiling (used by contract/tests)
  max_attempts?: number | null;
};

/**
 * Get all chunks for a manuscript, ordered by chunk_index
 */
export async function getManuscriptChunks(
  manuscriptId: number
): Promise<ChunkRow[]> {
  const { data, error } = await supabase
    .from("manuscript_chunks")
    .select("*")
    .eq("manuscript_id", manuscriptId)
    .order("chunk_index", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch chunks: ${error.message}`);
  }

  return (data as ChunkRow[]) || [];
}
/**
 * Get chunks for a specific job (Phase-2 linkage)
 * 
 * Filters by manuscript_id AND job_id to ensure Phase 2 only aggregates
 * chunks from the current job run, not stale data from previous runs.
 * 
 * Falls back to time-bounded manuscript query if job_id column doesn't exist yet.
 * SAFETY: Fallback validates chunk count to prevent aggregating stale/wrong chunks.
 */
export async function getChunksForJob(opts: {
  manuscriptId: number;
  jobId: string;
  phase1StartedAt?: string;
  phase1FinishedAt?: string;
  expectedChunkCount?: number;
}): Promise<ChunkRow[]> {
  const { manuscriptId, jobId, phase1StartedAt, phase1FinishedAt, expectedChunkCount } = opts;

  if (!jobId) {
    throw new Error("[getChunksForJob] job_id is required for Phase 2 queries");
  }

  // PRIMARY PATH: Try job-scoped query first (canonical)
  let query = supabase
    .from("manuscript_chunks")
    .select("*")
    .eq("manuscript_id", manuscriptId)
    .eq("job_id", jobId)
    .order("chunk_index", { ascending: true });

  let { data, error } = await query;

  // FALLBACK PATH: If job_id column doesn't exist, use time-bounded manuscript query
  const missingJobIdColumn = error?.message?.includes("job_id") && error?.message?.includes("does not exist");
  
  if (missingJobIdColumn) {
    console.warn(`[getChunksForJob] job_id column not found, using time-bounded fallback`);
    console.warn(`ACTION REQUIRED: Apply migration to add job_id column to manuscript_chunks`);
    
    if (!phase1StartedAt) {
      throw new Error("Cannot use fallback query without phase1StartedAt timestamp");
    }

    let fallbackQuery = supabase
      .from("manuscript_chunks")
      .select("*")
      .eq("manuscript_id", manuscriptId)
      .gte("created_at", phase1StartedAt);
    
    if (phase1FinishedAt) {
      fallbackQuery = fallbackQuery.lte("created_at", phase1FinishedAt);
    }
    
    fallbackQuery = fallbackQuery.order("chunk_index", { ascending: true });

    const fallbackResult = await fallbackQuery;
    
    if (fallbackResult.error) {
      console.error(`[getChunksForJob] Fallback query error:`, fallbackResult.error);
      throw new Error(`Failed to fetch chunks: ${fallbackResult.error.message}`);
    }

    data = fallbackResult.data;
    
    // SAFETY GUARD: Validate fallback chunk set
    if (expectedChunkCount !== undefined && data && data.length !== expectedChunkCount) {
      throw new Error(
        `Fallback chunk set invalid: expected ${expectedChunkCount} chunks, got ${data.length}. ` +
        `This may indicate stale/mixed chunks from prior job runs. Add job_id column to fix.`
      );
    }

    // SAFETY GUARD: Verify chunk indexes are contiguous
    if (data && data.length > 0) {
      const indexes = data.map((c: any) => c.chunk_index).sort((a, b) => a - b);
      const expectedIndexes = Array.from({ length: data.length }, (_, i) => i);
      const indexesMatch = indexes.every((idx, i) => idx === expectedIndexes[i]);
      
      if (!indexesMatch) {
        throw new Error(
          `Fallback chunk indexes non-contiguous: ${JSON.stringify(indexes)}. ` +
          `Expected 0..${data.length - 1}. This indicates mixed chunks from multiple job runs.`
        );
      }
    }

    return (data as ChunkRow[]) || [];
  }

  // PRIMARY PATH ERROR: Something other than missing job_id column
  if (error) {
    console.error(`[getChunksForJob] FULL ERROR:`, JSON.stringify(error, null, 2));
    console.error(`[getChunksForJob] error.message:`, error.message);
    console.error(`[getChunksForJob] error.details:`, error.details);
    console.error(`[getChunksForJob] error.hint:`, error.hint);
    console.error(`[getChunksForJob] error.code:`, error.code);
    throw new Error(`Failed to fetch chunks for job: ${error.message}`);  }

  return (data as ChunkRow[]) || [];
}
/**
 * Get eligible chunks for processing (resume + skip completed)
 *
 * Returns only chunks that are:
 * - status IN ('pending', 'failed')
 * - attempt_count < maxAttempts
 * - NOT 'done'
 *
 * Enables idempotent resume: never re-process 'done' chunks.
 */
export async function getEligibleChunks(
  manuscriptId: number,
  maxAttempts: number = 3
): Promise<ChunkRow[]> {
  const { data, error } = await supabase
    .from("manuscript_chunks")
    .select("*")
    .eq("manuscript_id", manuscriptId)
    .in("status", ["pending", "failed"])
    .lt("attempt_count", maxAttempts)
    .order("chunk_index", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch eligible chunks: ${error.message}`);
  }

  return (data as ChunkRow[]) || [];
}

/**
 * Get eligible chunks INCLUDING stuck 'processing' chunks
 *
 * A chunk is considered stuck if:
 * - status = 'processing'
 * - lease_expires_at is not null
 * - lease_expires_at is older than now (expired lease)
 *
 * This allows recovery from worker crashes via lease timeout.
 */
export async function getEligibleChunksWithStuckRecovery(
  manuscriptId: number,
  maxAttempts: number = 3
): Promise<ChunkRow[]> {
  const nowIso = new Date().toISOString();

  // Two-query approach to avoid subtle OR syntax errors:
  // 1) pending/failed
  // 2) processing + expired lease
  const [base, stuck] = await Promise.all([
    supabase
      .from("manuscript_chunks")
      .select("*")
      .eq("manuscript_id", manuscriptId)
      .in("status", ["pending", "failed"])
      .lt("attempt_count", maxAttempts),
    supabase
      .from("manuscript_chunks")
      .select("*")
      .eq("manuscript_id", manuscriptId)
      .eq("status", "processing")
      .not("lease_expires_at", "is", null)
      .lt("lease_expires_at", nowIso)
      .lt("attempt_count", maxAttempts),
  ]);

  if (base.error || stuck.error) {
    console.error(
      "Failed to fetch eligible chunks with stuck recovery",
      base.error?.message,
      stuck.error?.message
    );
    // Fallback to normal eligible chunks if complex query fails
    return getEligibleChunks(manuscriptId, maxAttempts);
  }

  const combined = [...(base.data ?? []), ...(stuck.data ?? [])];
  const byId = new Map((combined as any[]).map((c) => [c.id, c]));
  return Array.from(byId.values()) as ChunkRow[];
}

/**
 * Get a specific chunk by manuscript_id and chunk_index
 */
export async function getChunk(
  manuscriptId: number,
  chunkIndex: number
): Promise<ChunkRow | null> {
  const { data, error } = await supabase
    .from("manuscript_chunks")
    .select("*")
    .eq("manuscript_id", manuscriptId)
    .eq("chunk_index", chunkIndex)
    .single();

  if (error) {
    // PGRST116 = "Not found"
    if ((error as any).code === "PGRST116") return null;
    throw new Error(`Failed to fetch chunk: ${error.message}`);
  }

  return data as ChunkRow;
}

/**
 * Upsert chunks for a manuscript (idempotent)
 *
 * If a chunk with the same (manuscript_id, chunk_index) exists and has the
 * same content_hash, it's left unchanged. If the hash differs, content is
 * updated and status/results are reset.
 *
 * @param jobId - Links chunks to the evaluation job that created them (for Phase-2 linkage)
 */
export async function upsertChunks(
  manuscriptId: number,
  chunks: ChunkSpec[],
  jobId?: string
): Promise<void> {
  const existing = await getManuscriptChunks(manuscriptId);
  const existingMap = new Map(existing.map((c) => [c.chunk_index, c]));

  const toInsert: any[] = [];
  const toUpdate: any[] = [];

  for (const chunk of chunks) {
    const existingChunk = existingMap.get(chunk.chunk_index);

    if (!existingChunk) {
      // New chunk - insert
      toInsert.push({
        manuscript_id: manuscriptId,
        chunk_index: chunk.chunk_index,
        char_start: chunk.char_start,
        char_end: chunk.char_end,
        overlap_chars: chunk.overlap_chars,
        label: chunk.label,
        content: chunk.content,
        content_hash: chunk.content_hash,
        status: "pending",
        job_id: jobId || null,  // Link to job for Phase-2 filtering
      });
    } else if (existingChunk.content_hash !== chunk.content_hash) {
      // Content changed - update and reset status
      toUpdate.push({
        id: existingChunk.id,
        manuscript_id: manuscriptId,
        chunk_index: chunk.chunk_index,
        char_start: chunk.char_start,
        char_end: chunk.char_end,
        overlap_chars: chunk.overlap_chars,
        label: chunk.label,
        content: chunk.content,
        content_hash: chunk.content_hash,
        status: "pending",
        result_json: null,
        error: null,
        last_error: null,
        job_id: jobId || null,  // Update job linkage
      });
    }
    // else: hash matches, no change needed
  }

  // Delete chunks that no longer exist (if manuscript was re-chunked)
  const newIndexes = new Set(chunks.map((c) => c.chunk_index));
  const toDelete = existing
    .filter((c) => !newIndexes.has(c.chunk_index))
    .map((c) => c.id);

  // Execute operations
  if (toInsert.length > 0) {
    const { error } = await supabase
      .from("manuscript_chunks")
      .insert(toInsert);

    if (error) {
      throw new Error(`Failed to insert chunks: ${error.message}`);
    }
  }

  if (toUpdate.length > 0) {
    for (const chunk of toUpdate) {
      const { error } = await supabase
        .from("manuscript_chunks")
        .update(chunk)
        .eq("id", chunk.id);

      if (error) {
        throw new Error(
          `Failed to update chunk ${chunk.id}: ${error.message}`
        );
      }
    }
  }

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("manuscript_chunks")
      .delete()
      .in("id", toDelete);

    if (error) {
      throw new Error(`Failed to delete old chunks: ${error.message}`);
    }
  }
}

/**
 * Mark a chunk as successfully completed
 *
 * This is the ONLY function that writes result_json.
 * Always clears last_error and sets status to 'done'.
 */
export async function markChunkSuccess(
  manuscriptId: number,
  chunkIndex: number,
  resultJson: any,
  jobId?: string
): Promise<void> {
  const { error } = await supabase
    .from("manuscript_chunks")
    .update({
      status: "done",
      result_json: resultJson,
      last_error: null,
    })
    .eq("manuscript_id", manuscriptId)
    .eq("chunk_index", chunkIndex);

  if (error) {
    throw new Error(`Failed to mark chunk success: ${error.message}`);
  }
}

/**
 * Mark a chunk as failed
 *
 * CRITICAL: This function NEVER touches result_json.
 * This preserves any prior successful result through retries.
 */
export async function markChunkFailure(
  manuscriptId: number,
  chunkIndex: number,
  errorMessage: string
): Promise<void> {
  const { error } = await supabase
    .from("manuscript_chunks")
    .update({
      status: "failed",
      last_error: errorMessage,
      // IMPORTANT: result_json NOT included - preserves prior success
    })
    .eq("manuscript_id", manuscriptId)
    .eq("chunk_index", chunkIndex);

  if (error) {
    throw new Error(`Failed to mark chunk failure: ${error.message}`);
  }
}

/**
 * @deprecated Use markChunkSuccess() or markChunkFailure() instead.
 *
 * Generic update function - kept for backward compatibility.
 * Prefer the specific functions to enforce success/failure invariants.
 */
export async function updateChunkStatus(
  manuscriptId: number,
  chunkIndex: number,
  updates: {
    status?: "pending" | "processing" | "done" | "failed";
    result_json?: any;
    error?: string | null;
    last_error?: string | null;
    attempt_count?: number;
  }
): Promise<void> {
  // Clean updates object - remove undefined values
  const cleanUpdates = Object.fromEntries(
    Object.entries(updates).filter(([, v]) => v !== undefined)
  );

  const { error } = await supabase
    .from("manuscript_chunks")
    .update(cleanUpdates)
    .eq("manuscript_id", manuscriptId)
    .eq("chunk_index", chunkIndex);

  if (error) {
    throw new Error(`Failed to update chunk status: ${error.message}`);
  }
}

/**
 * Atomically claim a chunk for processing
 *
 * Returns true if the chunk was successfully claimed, false otherwise.
 *
 * Contract-aligned eligibility (enforced by RPC):
 * - status = 'pending'
 * - OR status = 'failed' AND attempt_count < max_attempts
 * - OR status = 'processing' AND lease_expires_at < now() (recovery)
 *
 * Hard "no" cases:
 * - status = 'done'
 * - attempt_count >= max_attempts
 */
export async function claimChunkForProcessing(
  chunkId: string,
  maxAttempts: number = 3
): Promise<boolean> {
  // 1) Preferred: RPC atomic claim (lease-based, server-side)
  const workerId =
    (process.env.RG_WORKER_ID as string | undefined) ?? randomUUID();

  const leaseSeconds =
    Number(process.env.RG_CHUNK_LEASE_SECONDS ?? 60) || 60;

  const { data: rpcData, error: rpcError} = await supabase.rpc(
    "claim_chunk_for_processing",
    {
      p_chunk_id: chunkId,
      p_worker_id: workerId,
      p_lease_seconds: leaseSeconds,
    }
  );

  if (!rpcError) {
    // RPC exists and executed; treat it as contract authority.
    return rpcData === true;
  }

  const msg = rpcError.message?.toLowerCase() ?? "";
  const canFallback =
    msg.includes("function") ||
    msg.includes("does not exist") ||
    msg.includes("schema cache");

  if (!canFallback) {
    // Real RPC error that is NOT "function missing" – do not
    // try to emulate behavior client-side.
    console.error(
      `[claimChunk] RPC error (non-fallback): ${rpcError.message}`
    );
    return false;
  }

  // 2) Optimistic locking fallback: Read current state
  const { data: current, error: readError } = await supabase
    .from("manuscript_chunks")
    .select("id, status, attempt_count, max_attempts, lease_expires_at")
    .eq("id", chunkId)
    .single();

  if (readError || !current) {
    return false;
  }

  const attemptCount: number = current.attempt_count ?? 0;
  const maxAllowed: number =
    current.max_attempts ?? maxAttempts;

  // Terminal immutability
  if (current.status === "done") return false;
  if (attemptCount >= maxAllowed) return false;

  // Recovery eligibility for stuck processing
  const now = Date.now();
  const leaseExpired =
    current.status === "processing" &&
    current.lease_expires_at != null &&
    new Date(current.lease_expires_at).getTime() < now;

  const eligibleStatus =
    current.status === "pending" ||
    current.status === "failed" ||
    leaseExpired;

  if (!eligibleStatus) return false;

  // 3) Conditional update with optimistic lock on attempt_count
  const { data: updateData, error: updateError } = await supabase
    .from("manuscript_chunks")
    .update({
      status: "processing",
      attempt_count: attemptCount + 1,
      last_error: null,
      lease_id: workerId,
      lease_expires_at: new Date(
        Date.now() + leaseSeconds * 1000
      ).toISOString(),
      processing_started_at: new Date().toISOString(),
    })
    .eq("id", chunkId)
    .eq("attempt_count", attemptCount) // optimistic lock
    .neq("status", "done")
    .select("id");

  if (updateError) {
    console.error(
      `[claimChunk] Optimistic update failed: ${updateError.message}`
    );
    return false;
  }

  // Success if exactly one row was updated
  return !!(updateData && updateData.length > 0);
}

/**
 * DEPRECATED: Use claimChunkForProcessing instead.
 * Direct update approach - not atomic, kept for emergency fallback only.
 */
export async function unsafeClaimChunk(chunkId: string): Promise<boolean> {
  // First, read current attempt_count
  const { data: current, error: readError } = await supabase
    .from("manuscript_chunks")
    .select("attempt_count, status")
    .eq("id", chunkId)
    .in("status", ["pending", "failed"])
    .single();

  if (readError || !current) {
    return false;
  }

  // Then update with incremented value (RACE CONDITION POSSIBLE)
  const { data: updateData, error: updateError } = await supabase
    .from("manuscript_chunks")
    .update({
      status: "processing",
      attempt_count: current.attempt_count + 1,
      last_error: null,
    })
    .eq("id", chunkId)
    .in("status", ["pending", "failed"])
    .select();

  if (updateError) {
    console.error(`Failed to claim chunk ${chunkId}:`, updateError);
    return false;
  }

  return !!(updateData && updateData.length > 0);
}

/**
 * Get the manuscript text from storage or database
 *
 * This is a placeholder - adapt to your actual manuscript storage strategy.
 */
export async function getManuscriptText(
  manuscriptId: number
): Promise<string> {
  // Try to fetch manuscript with storage columns, but handle schema evolution gracefully
  const { data, error } = await supabase
    .from("manuscripts")
    .select("file_url, title")
    .eq("id", manuscriptId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch manuscript: ${error.message}`);
  }

  // Try to get storage columns if they exist (for future schema evolution)
  // This is defensive against production DBs that may not have storage_bucket/storage_path yet
  const storageData = data as any;
  
  // Option 1: Fetch from Supabase Storage (preferred, if columns exist)
  if (storageData.storage_bucket && storageData.storage_path) {
    try {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(storageData.storage_bucket)
        .download(storageData.storage_path);

      if (downloadError) {
        throw new Error(
          `Failed to download from storage: ${downloadError.message}`
        );
      }

      // Convert blob to text
      const buffer = Buffer.from(await fileData.arrayBuffer());
      let text = buffer.toString("utf8");

      // Normalize line endings (CRLF → LF)
      text = text.replace(/\r\n/g, "\n");

      return text;
    } catch (storageError) {
      console.error(
        `[getManuscriptText] Storage fetch failed for manuscript ${manuscriptId}:`,
        storageError
      );
      // Fall through to next option
    }
  }

  // Option 2: Decode data URL directly (for pasted text)
  if (data.file_url && data.file_url.startsWith("data:")) {
    try {
      const match = data.file_url.match(/^data:[^,]*;base64,(.*)$/);
      if (match) {
        // Base64-encoded data URL
        const buffer = Buffer.from(match[1], "base64");
        let text = buffer.toString("utf8");
        text = text.replace(/\r\n/g, "\n");
        return text;
      }

      // URL-encoded data URL (data:text/plain;charset=utf-8,...)
      const urlEncodedMatch = data.file_url.match(/^data:[^,]*,(.*)$/);
      if (urlEncodedMatch) {
        let text = decodeURIComponent(urlEncodedMatch[1]);
        text = text.replace(/\r\n/g, "\n");
        return text;
      }

      throw new Error("Unsupported data URL format");
    } catch (dataUrlError) {
      console.error(
        `[getManuscriptText] Data URL decode failed for manuscript ${manuscriptId}:`,
        dataUrlError
      );
      // Fall through to next option
    }
  }

  // Option 3: Fetch via HTTP from file_url (legacy)
  if (data.file_url) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

      const response = await fetch(data.file_url, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (
        !contentType.includes("text/") &&
        !contentType.includes("application/octet-stream")
      ) {
        throw new Error(
          `Unsupported content-type: ${contentType}. Expected text/*`
        );
      }

      let text = await response.text();

      // Normalize line endings
      text = text.replace(/\r\n/g, "\n");

      return text;
    } catch (fetchError) {
      console.error(
        `[getManuscriptText] HTTP fetch failed for manuscript ${manuscriptId}:`,
        fetchError
      );
      // Fall through to placeholder
    }
  }

  // Option 4: Development fallback with realistic placeholder
  console.warn(
    `[getManuscriptText] No storage_path or file_url for manuscript ${manuscriptId}. Using placeholder.`
  );

  const placeholderChapters = [
    "Chapter 1: The Beginning\n\nIt was a dark and stormy night when our hero first set foot in the mysterious town. The rain pounded against the cobblestones, creating rivers that flowed down the ancient streets. In the distance, thunder rumbled like the growl of some ancient beast.",
    "Chapter 2: The Discovery\n\nThe ancient library held secrets that would change everything. Dust motes danced in the single shaft of light that pierced through the grimy windows. Our protagonist's fingers traced the spines of forgotten tomes, each one whispering promises of knowledge long lost to time.",
    "Chapter 3: The Journey\n\nAcross mountains and valleys, the quest continued with determination. Each step brought new challenges, new friends, and new enemies. The path ahead was uncertain, but the resolve in their heart remained steadfast.",
    "Chapter 4: The Revelation\n\nTruth emerged from the shadows, revealing the path forward. What had seemed like random coincidences suddenly formed a pattern, a grand design that had been invisible until this very moment. The pieces of the puzzle finally fell into place.",
    "Chapter 5: The Conclusion\n\nIn the end, courage and wisdom prevailed over darkness. The journey that had begun on that stormy night reached its culmination, and though the path had been difficult, the destination made every trial worthwhile.",
  ].join("\n\n");

  return placeholderChapters;
}

/**
 * Ensure chunks exist for a manuscript, creating them if needed
 * Returns the number of chunks.
 *
 * @param jobId - Links chunks to the evaluation job for Phase-2 filtering
 */
export async function ensureChunks(
  manuscriptId: number,
  jobId?: string
): Promise<number> {
  const existing = await getManuscriptChunks(manuscriptId);

  // If chunks exist and are valid, return count
  if (existing.length > 0) {
    return existing.length;
  }

  // Otherwise, fetch manuscript text and chunk it
  const text = await getManuscriptText(manuscriptId);
  const chunks = await chunkManuscript(text);

  // Upsert chunks (link to job)
  await upsertChunks(manuscriptId, chunks, jobId);

  return chunks.length;
}
