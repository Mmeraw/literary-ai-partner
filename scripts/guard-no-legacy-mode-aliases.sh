#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

legacy_upper="TRAUMA""_""MEMOIR"
legacy_lower="trauma""_""memoir"
legacy_phrase='[Tt]rauma'" "'memoir'
legacy_pattern="${legacy_upper}|${legacy_lower}|${legacy_phrase}"
hits_file="/tmp/legacy_mode_alias_hits.txt"

if rg -n --hidden --glob '!node_modules/**' --glob '!.git/**' "$legacy_pattern" >"$hits_file" 2>/dev/null; then
  echo "ERROR: legacy mode label detected (deprecated mode alias found)."
  echo "Use TESTIMONY/testimony instead."
  echo
  cat "$hits_file"
  exit 1
fi

echo "guard-no-legacy-mode-aliases: OK"
