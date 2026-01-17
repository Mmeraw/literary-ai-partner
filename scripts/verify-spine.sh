#!/usr/bin/env bash
set -euo pipefail

missing=0

require_file() {
  local f="$1"
  if [[ ! -f "$f" ]]; then
    echo "FAIL: Missing required file: $f"
    missing=1
  else
    echo "OK:   Found file: $f"
  fi
}

require_dir() {
  local d="$1"
  if [[ ! -d "$d" ]]; then
    echo "FAIL: Missing required directory: $d"
    missing=1
  else
    echo "OK:   Found directory: $d"
  fi
}

echo "== Golden Spine Guard =="

require_file "docs/GOLDEN_SPINE.md"
require_dir "docs"
require_dir "entities"
require_dir "schemas"
require_dir "scripts"
require_dir "supabase"
require_dir "lib"

if [[ "$missing" -ne 0 ]]; then
  echo "== RESULT: FAIL =="
  exit 1
fi

echo "== RESULT: PASS =="
