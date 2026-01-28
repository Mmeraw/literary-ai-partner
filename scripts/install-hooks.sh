#!/usr/bin/env bash
set -euo pipefail

# Self-installable, idempotent pre-push hook installer
# Usage: bash scripts/install-hooks.sh

cd "$(git rev-parse --show-toplevel)"

HOOK_SOURCE="scripts/pre-push.sh"
HOOK_TARGET=".git/hooks/pre-push"

if [[ ! -f "$HOOK_SOURCE" ]]; then
  echo "❌ Error: $HOOK_SOURCE not found"
  exit 1
fi

# Copy and make executable (idempotent)
cp "$HOOK_SOURCE" "$HOOK_TARGET"
chmod +x "$HOOK_TARGET"

echo "✅ Pre-push hook installed successfully"
echo "   Location: $HOOK_TARGET"
echo "   Next push will verify deployment documentation"
