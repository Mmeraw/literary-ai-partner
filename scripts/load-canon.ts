/* eslint-disable no-console */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import mammoth from 'mammoth';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
  console.error('Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY');
  process.exit(1);
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
      if (/\.(md|txt|docx)$/i.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

async function main() {
  const targetDir = process.argv[2];
  if (!targetDir) {
    console.error('Usage: tsx scripts/load-canon.ts <dir>');
    process.exit(1);
  }

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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
