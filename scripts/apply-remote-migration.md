# Apply Remote Migration: job_id Column

## CRITICAL: This migration must be applied to remote Supabase before Phase 2 will work

### Step 1: Open Supabase SQL Editor

Go to: https://supabase.com/dashboard/project/xtumxjnzdswuumndcbwc/sql/new

### Step 2: Run Migration SQL

Paste and execute this SQL:

```sql
-- Add job_id column to manuscript_chunks
ALTER TABLE public.manuscript_chunks 
  ADD COLUMN IF NOT EXISTS job_id UUID NULL;

-- Add indexes for efficient Phase 2 queries
CREATE INDEX IF NOT EXISTS idx_manuscript_chunks_job_id 
  ON public.manuscript_chunks(job_id) 
  WHERE job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_manuscript_chunks_manuscript_job 
  ON public.manuscript_chunks(manuscript_id, job_id) 
  WHERE job_id IS NOT NULL;

COMMENT ON COLUMN public.manuscript_chunks.job_id IS 
  'Links chunk to the evaluation job that created it. Ensures Phase 2 aggregates only current job chunks, not stale data from previous runs. NULL for legacy chunks created before this migration.';
```

### Step 3: Backfill existing chunks (OPTIONAL - only if you have production data)

If you have chunks from prior runs that need job_id backfilled, run this:

```sql
-- Backfill chunks for recent jobs by manuscript_id + time window
UPDATE public.manuscript_chunks c
SET job_id = j.id
FROM public.evaluation_jobs j
WHERE c.job_id IS NULL
  AND c.manuscript_id = j.manuscript_id
  AND c.created_at >= (j.created_at - interval '10 minutes')
  AND c.created_at <= (j.created_at + interval '2 hours');
```

For the vertical slice test, you don't need this - just delete old chunks:

```sql
DELETE FROM public.manuscript_chunks WHERE manuscript_id = 1;
```

### Step 4: Verify

Run this to confirm the column exists:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'manuscript_chunks' 
  AND column_name = 'job_id';
```

Expected output:
```
column_name | data_type
------------|----------
job_id      | uuid
```

### Step 5: Continue with code updates

After applying the migration, the code changes will make Phase 2 use the job_id column strictly.
