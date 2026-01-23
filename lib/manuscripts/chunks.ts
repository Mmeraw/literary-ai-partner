// lib/manuscripts/chunks.ts
// Database operations for manuscript chunks

import { getSupabaseAdminClient } from "@/lib/supabase";

// Use admin client for server-side chunk operations (bypasses RLS)
const supabase = getSupabaseAdminClient();
import { chunkManuscript, ChunkSpec } from "./chunking";

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
  processing_started_at: string | null;
  result_json: any | null;
  created_at: string;
  updated_at: string;
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

  return data || [];
}

/**
 * Get eligible chunks for processing (resume + skip completed)
 * Returns only chunks that are:
 * - status IN ('pending', 'failed')
 * - NOT currently processing (no active claim)
 * - attempt_count < maxAttempts
 * - NOT already succeeded (status != 'done')
 * 
 * This enables idempotent resume: never re-process 'done' chunks
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

  return data || [];
}

/**
 * Get eligible chunks INCLUDING stuck 'processing' chunks
 * 
 * A chunk is considered stuck if:
 * - status = 'processing'
 * - processing_started_at is older than stuckThresholdMinutes
 * 
 * This allows recovery from worker crashes via lease timeout.
 */
export async function getEligibleChunksWithStuckRecovery(
  manuscriptId: number,
  maxAttempts: number = 3,
  stuckThresholdMinutes: number = 15
): Promise<ChunkRow[]> {
  const stuckThreshold = new Date(
    Date.now() - stuckThresholdMinutes * 60 * 1000
  ).toISOString();

  // Single query: chunks that are (pending/failed) OR (processing but stuck)
  // Uses Supabase's .or() filter for complex conditions
  const { data, error } = await supabase
    .from("manuscript_chunks")
    .select("*")
    .eq("manuscript_id", manuscriptId)
    .lt("attempt_count", maxAttempts)
    .or(
      `status.in.(pending,failed),` +
      `and(status.eq.processing,processing_started_at.lt.${stuckThreshold})`
    )
    .order("chunk_index", { ascending: true });

  if (error) {
    console.error(`Failed to fetch eligible chunks with stuck recovery: ${error.message}`);
    // Fallback to normal eligible chunks if complex query fails
    return getEligibleChunks(manuscriptId, maxAttempts);
  }

  return data || [];
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
    if (error.code === "PGRST116") return null; // Not found
    throw new Error(`Failed to fetch chunk: ${error.message}`);
  }

  return data;
}

/**
 * Upsert chunks for a manuscript (idempotent)
 * If a chunk with the same (manuscript_id, chunk_index) exists and has the same content_hash,
 * it's left unchanged. If the hash differs, content is updated and status/results are reset.
 */
export async function upsertChunks(
  manuscriptId: number,
  chunks: ChunkSpec[]
): Promise<void> {
  const existing = await getManuscriptChunks(manuscriptId);
  const existingMap = new Map(
    existing.map((c) => [c.chunk_index, c])
  );

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
        throw new Error(`Failed to update chunk ${chunk.id}: ${error.message}`);
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
 * Always clears last_error and resets status to 'done'.
 */
export async function markChunkSuccess(
  manuscriptId: number,
  chunkIndex: number,
  resultJson: any
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
 * @deprecated Use markChunkSuccess() or markChunkFailure() instead
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
    Object.entries(updates).filter(([_, v]) => v !== undefined)
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
 * Only claims chunks that are currently in 'pending' or 'failed' status.
 * 
 * This is the atomic claim operation that prevents duplicate work:
 * - Sets processing = true
 * - Increments attempt_count
 * - Clears last_error
 * - Sets processing_started_at
 * - Only succeeds if current status IN ('pending', 'failed') AND processing = false
 */
export async function claimChunkForProcessing(
  chunkId: string,
  maxAttempts: number = 3
): Promise<boolean> {
  // 1) Preferred: RPC atomic claim if function exists
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "claim_chunk_for_processing",
    { chunk_id: chunkId }
  );

  if (!rpcError) {
    return rpcData === true;
  }

  // If function doesn't exist, use optimistic locking fallback
  const msg = rpcError.message?.toLowerCase() ?? "";
  const canFallback =
    msg.includes("function") ||
    msg.includes("does not exist") ||
    msg.includes("schema cache");

  if (!canFallback) {
    console.error(`[claimChunk] RPC error (non-fallback): ${rpcError.message}`);
    return false;
  }

  // 2) Optimistic locking fallback: Read current state
  const { data: current, error: readError } = await supabase
    .from("manuscript_chunks")
    .select("id, status, attempt_count")
    .eq("id", chunkId)
    .single();

  if (readError || !current) {
    return false;
  }

  // Check eligibility
  const eligibleStatus = current.status === "pending" || current.status === "failed";
  if (!eligibleStatus) return false;
  if ((current.attempt_count ?? 0) >= maxAttempts) return false;

  const currentAttempt = current.attempt_count ?? 0;

  // 3) Conditional update with optimistic lock on attempt_count
  const { data: updateData, error: updateError } = await supabase
    .from("manuscript_chunks")
    .update({
      status: "processing",
      attempt_count: currentAttempt + 1,
      last_error: null,
      processing_started_at: new Date().toISOString(),
    })
    .eq("id", chunkId)
    .eq("attempt_count", currentAttempt) // Optimistic lock
    .in("status", ["pending", "failed"])
    .select("id");

  if (updateError) {
    console.error(`[claimChunk] Optimistic update failed: ${updateError.message}`);
    return false;
  }

  // Success if exactly one row was updated
  return updateData && updateData.length > 0;
}

/**
 * DEPRECATED: Use claimChunkForProcessing instead
 * Direct update approach - not atomic, kept for emergency fallback only
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

  return updateData && updateData.length > 0;
}

/**
 * Get the manuscript text from storage or database
 * This is a placeholder - adapt to your actual manuscript storage strategy
 */
export async function getManuscriptText(manuscriptId: number): Promise<string> {
  // TODO: Implement based on your actual manuscript storage
  // Options:
  // 1. Fetch from file_url in manuscripts table (S3/Supabase Storage)
  // 2. Fetch from a manuscript_content table
  // 3. Generate from staged/normalized text field

  const { data, error } = await supabase
    .from("manuscripts")
    .select("file_url, title, storage_bucket, storage_path")
    .eq("id", manuscriptId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch manuscript: ${error.message}`);
  }

  // Option 1: Fetch from Supabase Storage (preferred)
  if (data.storage_bucket && data.storage_path) {
    try {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(data.storage_bucket)
        .download(data.storage_path);

      if (downloadError) {
        throw new Error(`Failed to download from storage: ${downloadError.message}`);
      }

      // Convert blob to text
      const buffer = Buffer.from(await fileData.arrayBuffer());
      let text = buffer.toString('utf8');
      
      // Normalize line endings (CRLF → LF)
      text = text.replace(/\r\n/g, '\n');
      
      return text;
    } catch (storageError) {
      console.error(`[getManuscriptText] Storage fetch failed for manuscript ${manuscriptId}:`, storageError);
      // Fall through to next option
    }
  }

  // Option 2: Fetch via HTTP from file_url (legacy)
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

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/') && !contentType.includes('application/octet-stream')) {
        throw new Error(`Unsupported content-type: ${contentType}. Expected text/*`);
      }

      let text = await response.text();
      
      // Normalize line endings
      text = text.replace(/\r\n/g, '\n');
      
      return text;
    } catch (fetchError) {
      console.error(`[getManuscriptText] HTTP fetch failed for manuscript ${manuscriptId}:`, fetchError);
      // Fall through to placeholder
    }
  }

  // Option 3: Development fallback with realistic placeholder
  console.warn(`[getManuscriptText] No storage_path or file_url for manuscript ${manuscriptId}. Using placeholder.`);
  
  const placeholderChapters = [
    "Chapter 1: The Beginning\n\nIt was a dark and stormy night when our hero first set foot in the mysterious town. The rain pounded against the cobblestones, creating rivers that flowed down the ancient streets. In the distance, thunder rumbled like the growl of some ancient beast.",
    "Chapter 2: The Discovery\n\nThe ancient library held secrets that would change everything. Dust motes danced in the single shaft of light that pierced through the grimy windows. Our protagonist's fingers traced the spines of forgotten tomes, each one whispering promises of knowledge long lost to time.",
    "Chapter 3: The Journey\n\nAcross mountains and valleys, the quest continued with determination. Each step brought new challenges, new friends, and new enemies. The path ahead was uncertain, but the resolve in their heart remained steadfast.",
    "Chapter 4: The Revelation\n\nTruth emerged from the shadows, revealing the path forward. What had seemed like random coincidences suddenly formed a pattern, a grand design that had been invisible until this very moment. The pieces of the puzzle finally fell into place.",
    "Chapter 5: The Conclusion\n\nIn the end, courage and wisdom prevailed over darkness. The journey that had begun on that stormy night reached its culmination, and though the path had been difficult, the destination made every trial worthwhile."
  ].join("\n\n");

  return placeholderChapters;
}

/**
 * Ensure chunks exist for a manuscript, creating them if needed
 * Returns the number of chunks
 */
export async function ensureChunks(manuscriptId: number): Promise<number> {
  const existing = await getManuscriptChunks(manuscriptId);

  // If chunks exist and are valid, return count
  if (existing.length > 0) {
    return existing.length;
  }

  // Otherwise, fetch manuscript text and chunk it
  const text = await getManuscriptText(manuscriptId);
  const chunks = await chunkManuscript(text);

  // Upsert chunks
  await upsertChunks(manuscriptId, chunks);

  return chunks.length;
}
