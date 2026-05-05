-- Canon RAG schema: ensure pass_scope column + generated scope column exist
-- before creating the GIN index. Mirrors production (Primary DB) exactly.

ALTER TABLE public.canon_documents
  ADD COLUMN IF NOT EXISTS pass_scope text[] DEFAULT '{}'::text[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'canon_documents'
      AND column_name  = 'scope'
  ) THEN
    EXECUTE 'ALTER TABLE public.canon_documents
             ADD COLUMN scope text[] GENERATED ALWAYS AS (pass_scope) STORED';
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS canon_documents_pass_scope_idx
  ON public.canon_documents USING GIN (pass_scope);
