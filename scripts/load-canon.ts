/* eslint-disable no-console */
import fs from 'fs/promises';
import { existsSync } from 'node:fs';
import path from 'path';
import crypto from 'crypto';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import mammoth from 'mammoth';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

// PR-0: env-var hard exit moved into main() for test importability.

// --- PR-0: canon ingest gate (md-only under docs/canon/_md) ---
export const CANON_ROOT = path.resolve(process.cwd(), 'docs/canon/_md');
const ALLOWED_EXT = new Set(['.md']);

/**
 * Canon ingest gate. Returns ok=true only if absPath sits under CANON_ROOT
 * and has an allowed extension. Used at walk-time and exported for tests.
 */
export function isIngestable(absPath: string): { ok: boolean; reason?: string } {
  const rel = path.relative(CANON_ROOT, absPath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return { ok: false, reason: 'outside_canon_md_root' };
  }
  const ext = path.extname(absPath).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return { ok: false, reason: 'disallowed_extension:' + (ext || 'none') };
  }
  return { ok: true };
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const CHUNK_SIZE = 800; // words approx
const CHUNK_OVERLAP = 100;

function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

async function readDoc(filePath: string): Promise<string> {
  if (filePath.endsWith('.md') || filePath.endsWith('.txt')) {
    return fs.readFile(filePath, 'utf-8');
  }

  if (filePath.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  throw new Error(`Unsupported file type: ${filePath}`);
}

function chunkText(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
    const slice = words.slice(i, i + CHUNK_SIZE);
    if (slice.length === 0) continue;
    chunks.push(slice.join(' '));
  }

  return chunks;
}

async function embed(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  });
  return res.data[0].embedding as unknown as number[];
}

async function upsertDocument(filePath: string, content: string) {
  const filename = path.basename(filePath);
  const contentHash = sha256(content);

  const { data, error } = await supabase
    .from('canon_documents')
    .upsert(
      {
        filename,
        path: filePath,
        raw_content: content,
        content_hash: contentHash,
        source_sha: process.env.GITHUB_SHA || null
      },
      { onConflict: 'filename' }
    )
    .select()
    .single();

  if (error) throw error;

  return data;
}

async function replaceChunks(documentId: string, chunks: string[]) {
  await supabase.from('canon_chunks').delete().eq('document_id', documentId);

  for (let i = 0; i < chunks.length; i++) {
    const content = chunks[i];
    const embedding = await embed(content);

    const { error } = await supabase.from('canon_chunks').insert({
      document_id: documentId,
      chunk_index: i,
      content,
      embedding,
      content_hash: sha256(content),
      token_count: content.split(/\s+/).length
    });

    if (error) throw error;

    if (i % 5 === 0) {
      console.log(`Inserted chunk ${i + 1}/${chunks.length}`);
    }
  }
}

async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else if (entry.isFile()) {
      if (isIngestable(fullPath).ok) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
    console.error('Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY');
    process.exit(1);
  }
  // PR-0: ignore argv; canon root is hard-pinned to docs/canon/_md.
  if (process.argv[2]) {
    console.warn('[canon-loader] ignoring argv path "' + process.argv[2] + '"; canon root is pinned to ' + CANON_ROOT);
  }
  if (!existsSync(CANON_ROOT)) {
    console.error('Canon root missing: ' + CANON_ROOT);
    process.exit(1);
  }
  const targetDir = CANON_ROOT;

  const files = await walk(targetDir);
  console.log(`Found ${files.length} canon files`);

  for (const file of files) {
    console.log(`\nProcessing: ${file}`);

    const content = await readDoc(file);
    const doc = await upsertDocument(file, content);

    const chunks = chunkText(content);
    console.log(`Chunk count: ${chunks.length}`);

    await replaceChunks(doc.id, chunks);
  }

  console.log('\nCanon load complete');
}

// PR-0: only auto-run when invoked directly (allows isIngestable to be imported by tests).
const _isEntrypoint =
  typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module;
if (_isEntrypoint) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
