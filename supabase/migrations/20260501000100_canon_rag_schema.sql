-- Canon RAG schema
-- Purpose:
--   Repo markdown files remain the source of truth.
--   Supabase stores a searchable runtime index of that truth.
--
-- Safety:
--   This migration only creates new canon_* tables, indexes, and an RPC helper.
--   It does not alter or drop existing application tables.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.canon_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL UNIQUE,
  path TEXT NOT NULL,
  canon_id TEXT,
  volume TEXT,
  authority TEXT NOT NULL DEFAULT 'reference'
    CHECK (authority IN ('binding', 'enforced', 'advisory', 'reference')),
  scope TEXT[] NOT NULL DEFAULT '{}',
  precedence_rank INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  source_sha TEXT,
  content_hash TEXT NOT NULL,
  raw_content TEXT NOT NULL,
  summary TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.canon_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.canon_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  heading_path TEXT,
  content TEXT NOT NULL,
  concern_tags TEXT[] NOT NULL DEFAULT '{}',
  embedding vector(1536),
  token_count INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS public.canon_governance_rules (
  rule_id TEXT PRIMARY KEY,
  canon_id TEXT NOT NULL,
  document_id UUID REFERENCES public.canon_documents(id) ON DELETE SET NULL,
  predicate_name TEXT NOT NULL,
  injection_point TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('error', 'warn', 'advisory')),
  mode TEXT NOT NULL CHECK (mode IN ('fail_closed', 'warn_only', 'audit_only')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  source_section_ref TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS canon_documents_scope_idx
  ON public.canon_documents USING GIN (scope);

CREATE INDEX IF NOT EXISTS canon_documents_canon_id_idx
  ON public.canon_documents (canon_id);

CREATE INDEX IF NOT EXISTS canon_documents_authority_idx
  ON public.canon_documents (authority, is_active, precedence_rank);

CREATE INDEX IF NOT EXISTS canon_chunks_concern_tags_idx
  ON public.canon_chunks USING GIN (concern_tags);

CREATE INDEX IF NOT EXISTS canon_chunks_document_idx
  ON public.canon_chunks (document_id, chunk_index);

CREATE INDEX IF NOT EXISTS canon_governance_rules_lookup_idx
  ON public.canon_governance_rules (canon_id, injection_point, is_active);

-- Vector index. Lists value is intentionally conservative for a small canon corpus.
CREATE INDEX IF NOT EXISTS canon_chunks_embedding_idx
  ON public.canon_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

ALTER TABLE public.canon_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canon_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canon_governance_rules ENABLE ROW LEVEL SECURITY;

-- Runtime/server-side callers should use the service role client for canon search.
-- No public anon policies are added here on purpose.

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS canon_documents_touch_updated_at ON public.canon_documents;
CREATE TRIGGER canon_documents_touch_updated_at
BEFORE UPDATE ON public.canon_documents
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS canon_governance_rules_touch_updated_at ON public.canon_governance_rules;
CREATE TRIGGER canon_governance_rules_touch_updated_at
BEFORE UPDATE ON public.canon_governance_rules
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.match_canon_chunks(
  query_embedding vector(1536),
  match_count INTEGER DEFAULT 5,
  match_threshold DOUBLE PRECISION DEFAULT 0,
  filter_concern_tags TEXT[] DEFAULT NULL,
  filter_authorities TEXT[] DEFAULT NULL,
  filter_canon_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  filename TEXT,
  path TEXT,
  canon_id TEXT,
  authority TEXT,
  scope TEXT[],
  heading_path TEXT,
  content TEXT,
  concern_tags TEXT[],
  similarity DOUBLE PRECISION
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    c.id AS chunk_id,
    d.id AS document_id,
    d.filename,
    d.path,
    d.canon_id,
    d.authority,
    d.scope,
    c.heading_path,
    c.content,
    c.concern_tags,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.canon_chunks c
  JOIN public.canon_documents d ON d.id = c.document_id
  WHERE
    d.is_active = true
    AND c.embedding IS NOT NULL
    AND (filter_concern_tags IS NULL OR c.concern_tags && filter_concern_tags)
    AND (filter_authorities IS NULL OR d.authority = ANY(filter_authorities))
    AND (filter_canon_id IS NULL OR d.canon_id = filter_canon_id)
    AND (1 - (c.embedding <=> query_embedding)) >= match_threshold
  ORDER BY
    d.precedence_rank ASC,
    c.embedding <=> query_embedding ASC
  LIMIT LEAST(GREATEST(match_count, 1), 20);
$$;

COMMENT ON TABLE public.canon_documents IS 'Canonical doctrine documents synced from repo docs/canon. Repo remains source of truth.';
COMMENT ON TABLE public.canon_chunks IS 'Chunked and embedded canon passages for runtime semantic retrieval.';
COMMENT ON TABLE public.canon_governance_rules IS 'Canon-registered governance rules and injection points.';
COMMENT ON FUNCTION public.match_canon_chunks IS 'Semantic search over canon chunks. Intended for service-role runtime use.';
