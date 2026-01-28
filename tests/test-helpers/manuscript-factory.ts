/**
 * Test helpers for manuscript and chunk creation
 *
 * These are test-only utilities for setting up realistic manuscript + chunk state
 * without mocks. All operations use real Supabase (test DB) and existing production
 * functions.
 *
 * Usage:
 *   const { manuscriptId, chunks } = await createTestManuscriptWithChunks({ chunkCount: 5 });
 *   const chunk = await getChunkById(chunks[0].id);
 *   await forceUpdateChunk(chunks[0].id, { status: 'processing', processing_started_at: ... });
 */

import { getSupabaseAdminClient } from "@/lib/supabase";
import { ensureChunks, getManuscriptChunks } from "@/lib/manuscripts/chunks";
import { randomUUID } from "crypto";

const supabase = getSupabaseAdminClient();

export type TestChunkInfo = {
  id: string;
  status: string;
  attempt_count: number;
};

/**
 * Create a minimal test manuscript (no chunks)
 * 
 * Use this for tests that need a manuscript but don't need chunk processing.
 * Guarantees schema alignment across all tests.
 * 
 * @param options Configuration for manuscript creation
 * @returns Manuscript ID
 * @throws If manuscript creation fails
 */
export async function createTestManuscript(options: {
  title?: string;
  userId?: string;
  wordCount?: number;
}): Promise<number> {
  const { 
    title = `phase2d3:${randomUUID()}`, 
    userId = "58308033-a93e-48e2-805e-0ecdc7fd157f",
    wordCount = 50000 
  } = options;

  const { data: manuscript, error: manuscriptError } = await supabase
    .from("manuscripts")
    .insert({
      title,
      created_by: userId,
      user_id: userId,
      tone_context: "neutral",
      mood_context: "calm",
      voice_mode: "balanced",
      word_count: wordCount,
      source: "dashboard",
      english_variant: "us",
      is_final: false,
      storygate_linked: false,
      allow_industry_discovery: false,
    })
    .select()
    .single();

  if (manuscriptError || !manuscript) {
    throw new Error(
      `Failed to create test manuscript: ${manuscriptError?.message || "unknown error"}`
    );
  }

  return manuscript.id;
}

/**
 * Create a test manuscript with chunks in pending state
 *
 * This function:
 * 1. Inserts a minimal manuscript into the DB
 * 2. Generates chunks from sample text (via ensureChunks)
 * 3. Returns manuscript ID + chunk metadata
 *
 * @param options Configuration for manuscript creation
 * @returns Manuscript ID and array of pending chunks
 *
 * @throws If manuscript creation or chunking fails
 */
export async function createTestManuscriptWithChunks(options: {
  chunkCount?: number; // Ignored; chunks are generated from sample text
  title?: string;
  userId?: string;
}): Promise<{
  manuscriptId: number;
  chunks: TestChunkInfo[];
}> {
  const { title = "Test Manuscript", userId = "58308033-a93e-48e2-805e-0ecdc7fd157f" } = options;

  // Generate sample text large enough to create multiple chunks
  // Each chunk is roughly 1000-1500 chars with overlap, so ~5000 chars ensures >3 chunks
  const sampleText = generateSampleManuscriptText(5000);

  // 1) Insert manuscript
  const { data: manuscript, error: manuscriptError } = await supabase
    .from("manuscripts")
    .insert({
      title,
      created_by: userId,
      user_id: userId,
      tone_context: "neutral",
      mood_context: "calm",
      voice_mode: "balanced",
      word_count: sampleText.split(/\s+/).length,
      source: "dashboard",
      english_variant: "us",
      is_final: false,
      storygate_linked: false,
      allow_industry_discovery: false,
    })
    .select()
    .single();

  if (manuscriptError || !manuscript) {
    throw new Error(
      `Failed to create test manuscript: ${manuscriptError?.message || "unknown error"}`
    );
  }

  const manuscriptId = manuscript.id;

  // 2) Store the sample text so ensureChunks can retrieve it
  // We need to inject it into the text storage (typically file_url or similar)
  // For now, we'll use a temporary approach: save to a test storage location
  // Actually, the better approach is to mock getManuscriptText temporarily or
  // directly insert chunks. Let's use the direct approach:

  // 3) Directly insert chunks (bypassing the text retrieval + chunkManuscript flow)
  const chunks = generateTestChunks(sampleText, manuscriptId);

  const { error: chunkError } = await supabase
    .from("manuscript_chunks")
    .insert(chunks);

  if (chunkError) {
    throw new Error(
      `Failed to insert test chunks: ${chunkError.message}`
    );
  }

  // 4) Fetch and return chunk metadata
  const createdChunks = await getManuscriptChunks(manuscriptId);
  const chunkInfo: TestChunkInfo[] = createdChunks.map((chunk) => ({
    id: chunk.id,
    status: chunk.status,
    attempt_count: chunk.attempt_count,
  }));

  return {
    manuscriptId,
    chunks: chunkInfo,
  };
}

/**
 * Get a chunk by ID directly from the database
 *
 * This is used in tests to verify post-mutation state.
 * Always reads fresh from DB (no caching).
 *
 * @param chunkId Chunk UUID
 * @returns Full chunk row or null if not found
 */
export async function getChunkById(chunkId: string) {
  const { data, error } = await supabase
    .from("manuscript_chunks")
    .select("*")
    .eq("id", chunkId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw new Error(`Failed to fetch chunk: ${error.message}`);
  }

  return data;
}

/**
 * Directly update a chunk in the database (test-only, unsafe by design)
 *
 * ⚠️ WARNING: This function bypasses all normal mutation guards.
 * It is ONLY for simulating crashes, corrupted state, and other
 * exceptional conditions in tests.
 *
 * Do NOT import this into production code.
 *
 * @param chunkId Chunk UUID
 * @param patch Partial chunk fields to update
 *
 * @throws If update fails
 */
export async function forceUpdateChunk(
  chunkId: string,
  patch: Partial<{
    status: string;
    processing_started_at: string | null;
    lease_expires_at: string | null;
    last_error: string | null;
    attempt_count: number;
    result_json: Record<string, unknown> | null;
  }>
): Promise<void> {
  const { error } = await supabase
    .from("manuscript_chunks")
    .update(patch)
    .eq("id", chunkId);

  if (error) {
    throw new Error(`Failed to force-update chunk: ${error.message}`);
  }
}

/**
 * Generate sample manuscript text for testing
 * Creates a multi-paragraph document large enough to generate multiple chunks
 *
 * @param targetCharCount Approximate target character count
 * @returns Sample text
 */
function generateSampleManuscriptText(targetCharCount: number): string {
  const paragraph =
    "The morning light filtered through the old library windows, casting long shadows across " +
    "shelves laden with forgotten stories. Each spine told a tale of readers past, of minds " +
    "that had wandered these pages seeking solace, knowledge, or escape. The air itself seemed " +
    "thick with possibility, as if the very ink could whisper secrets to those patient enough " +
    "to listen. She ran her fingers along the wood, feeling the grain beneath her skin, and " +
    "wondered what stories had shaped the lives of those before her.\n\n";

  let text = "";
  while (text.length < targetCharCount) {
    text += paragraph;
  }

  return text.slice(0, targetCharCount);
}

/**
 * Generate test chunks from sample text
 * Mimics the output of chunkManuscript() for test setup
 *
 * @param text Sample manuscript text
 * @param manuscriptId Manuscript ID to associate chunks with
 * @returns Array of chunks ready to insert
 */
function generateTestChunks(
  text: string,
  manuscriptId: number
): Array<{
  manuscript_id: number;
  chunk_index: number;
  char_start: number;
  char_end: number;
  overlap_chars: number;
  label: string | null;
  content: string;
  content_hash: string;
  status: "pending" | "processing" | "done" | "failed";
  attempt_count: number;
  last_error: string | null;
  processing_started_at: string | null;
  result_json: null;
}> {
  const chunkSize = 1000;
  const overlapSize = 100;
  const chunks = [];

  for (let i = 0; i < text.length; i += chunkSize - overlapSize) {
    const charStart = Math.max(0, i);
    const charEnd = Math.min(text.length, i + chunkSize);
    const content = text.slice(
      Math.max(0, charStart - overlapSize),
      charEnd
    );
    const overlapChars = charStart > 0 ? overlapSize : 0;

    chunks.push({
      manuscript_id: manuscriptId,
      chunk_index: chunks.length,
      char_start: charStart,
      char_end: charEnd,
      overlap_chars: overlapChars,
      label: null,
      content,
      content_hash: simpleHash(content),
      status: "pending" as const,
      attempt_count: 0,
      last_error: null,
      processing_started_at: null,
      result_json: null,
    });

    if (charEnd >= text.length) break;
  }

  return chunks;
}

/**
 * Simple hash function for content integrity
 * NOT cryptographically secure; for testing only
 *
 * @param text Text to hash
 * @returns Hash string
 */
function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `hash_${Math.abs(hash).toString(16)}`;
}
