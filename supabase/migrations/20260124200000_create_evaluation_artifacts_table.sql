-- Migration: 20260124200000_create_evaluation_artifacts_table.sql
-- NOTE: superseded by 20260124000000_evaluation_artifacts.sql.
-- This migration is intentionally a no-op to keep history in sync.

DO $$ BEGIN
  RAISE NOTICE 'Skipping 20260124200000_create_evaluation_artifacts_table.sql: superseded by 20260124000000_evaluation_artifacts.sql';
END $$;
