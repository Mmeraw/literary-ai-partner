#!/usr/bin/env bash
set -euo pipefail

# Pre-branch guard: fail fast when working tree is not clean.
# Usage:
#   bash scripts/guard-clean-tree.sh

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "❌ Working tree not clean. Aborting."
  git status --short
  exit 1
fi

echo "✅ Working tree clean"
