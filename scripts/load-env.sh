#!/usr/bin/env bash
# Load .env.local into current shell and verify required vars
# Usage: source scripts/load-env.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$ROOT/.env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found"
  return 1 2>/dev/null || exit 1
fi

set -a
source "$ENV_FILE"
set +a

echo "=== Environment Variable Check ==="
REQUIRED_VARS=(OPENAI_API_KEY NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY)
ALL_OK=true
for var in "${REQUIRED_VARS[@]}"; do
  val="${!var}"
  if [ -z "$val" ]; then
    echo "  MISSING: $var"
    ALL_OK=false
  else
    echo "  OK:      $var (${#val} chars)"
  fi
done

if $ALL_OK; then
  echo "All required env vars loaded successfully."
else
  echo "WARNING: Some required env vars are missing. See above."
fi
