#!/bin/bash
# Apply Phase 2 governance migrations to Supabase
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
for f in "$DIR"/migrations/002_*.sql "$DIR"/migrations/003_*.sql "$DIR"/migrations/004_*.sql; do
  echo "=== Applying $(basename $f) ==="
  cat "$f"
  echo
done
echo "Copy the above SQL and run it in Supabase SQL Editor"
