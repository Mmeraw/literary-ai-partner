#!/usr/bin/env bash
set -euo pipefail

FILE="jest.setup.ts"

if [ ! -f "$FILE" ]; then
  echo "❌ $FILE missing"
  exit 1
fi

if ! grep -q "@/" "$FILE"; then
  echo "❌ jest.setup.ts must use '@/...' alias imports only"
  exit 1
fi

if grep -q "\.\./" "$FILE"; then
  echo "❌ relative imports detected in jest.setup.ts"
  exit 1
fi

echo "✅ jest setup guard OK"
