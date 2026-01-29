-- Migration: Fix manuscript_chunks.manuscript_id type mismatch
-- Date: 2026-01-29
-- Purpose: Align manuscript_chunks.manuscript_id with manuscripts.id (both bigint)
-- Issue: FK was integer -> bigint (risky for edge cases, indexes, client code)

-- Step 1: Drop RLS policies that reference manuscript_id
DROP POLICY IF EXISTS "Author: view own manuscript chunks" ON public.manuscript_chunks;
DROP POLICY IF EXISTS "Admin: view Storygate manuscript chunks" ON public.manuscript_chunks;

-- Step 2: Drop the existing FK constraint
ALTER TABLE public.manuscript_chunks
  DROP CONSTRAINT IF EXISTS manuscript_chunks_manuscript_id_fkey;

-- Step 3: Change column type from integer to bigint
-- This is safe even with data because integer values fit in bigint
ALTER TABLE public.manuscript_chunks
  ALTER COLUMN manuscript_id TYPE bigint;

-- Step 4: Recreate the FK constraint
ALTER TABLE public.manuscript_chunks
  ADD CONSTRAINT manuscript_chunks_manuscript_id_fkey
    FOREIGN KEY (manuscript_id)
    REFERENCES public.manuscripts(id)
    ON DELETE CASCADE;

-- Step 5: Recreate RLS policies with correct types
CREATE POLICY "Author: view own manuscript chunks"
  ON public.manuscript_chunks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.manuscripts m
      WHERE m.id = manuscript_chunks.manuscript_id
        AND m.created_by = auth.uid()
    )
  );

CREATE POLICY "Admin: view Storygate manuscript chunks"
  ON public.manuscript_chunks
  FOR SELECT
  USING (
    (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'admin_reviewer'::text)
    AND EXISTS (
      SELECT 1 FROM public.manuscripts m
      WHERE m.id = manuscript_chunks.manuscript_id
        AND m.storygate_linked = true
    )
  );

-- Verification: All FK columns to manuscripts.id should now be bigint
-- Expected output: 4 rows, all bigint
DO $$
DECLARE
  mismatched_count integer;
BEGIN
  SELECT COUNT(*) INTO mismatched_count
  FROM information_schema.table_constraints AS tc 
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  JOIN pg_attribute a ON a.attname = kcu.column_name
    AND a.attrelid = (tc.table_schema || '.' || tc.table_name)::regclass
  WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND ccu.table_name = 'manuscripts'
    AND tc.table_schema = 'public'
    AND pg_catalog.format_type(a.atttypid, a.atttypmod) != 'bigint';
  
  IF mismatched_count > 0 THEN
    RAISE EXCEPTION 'Type mismatch detected: % FK columns to manuscripts.id are not bigint', mismatched_count;
  END IF;
  
  RAISE NOTICE 'Migration successful: All FK columns to manuscripts.id are now bigint';
END $$;
