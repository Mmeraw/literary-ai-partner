#!/usr/bin/env bash
set -euo pipefail

echo "[guard-migration-safety] scanning Supabase migrations"

if rg -n -U "CREATE OR REPLACE FUNCTION[\s\S]{0,700}RETURNS TABLE" supabase/migrations; then
  echo ""
  echo "❌ Illegal migration pattern detected."
  echo "CREATE OR REPLACE FUNCTION cannot safely change RETURNS TABLE / OUT parameter contracts."
  echo "Use a single-statement-safe DO block with DROP FUNCTION + CREATE FUNCTION dynamic SQL."
  exit 1
fi

if rg -n "CREATE OR REPLACE FUNCTION public\.claim_job_atomic" supabase/migrations; then
  echo ""
  echo "❌ claim_job_atomic must be recreated with DROP FUNCTION + CREATE FUNCTION."
  echo "This prevents Postgres SQLSTATE 42P13 return-type drift failures."
  exit 1
fi

echo "✅ migration safety OK"
