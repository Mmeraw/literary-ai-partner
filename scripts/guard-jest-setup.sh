#!/usr/bin/env bash
set -euo pipefail

FILE="jest.setup.ts"

if [ ! -f "$FILE" ]; then
  echo "❌ $FILE missing"
  exit 1
fi

if rg -n 'from "@/|from '\''@/' "$FILE"; then
  echo ""
  echo "❌ Alias import in jest.setup.ts is forbidden."
  echo "Jest setup files run before path alias resolution is reliable; use relative imports."
  exit 1
fi

echo "✅ jest setup guard OK"
