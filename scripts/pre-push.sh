#!/usr/bin/env bash
# Pre-push hook: verify deployment documentation before any push
# Install: cp scripts/pre-push.sh .git/hooks/pre-push && chmod +x .git/hooks/pre-push

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

echo "🔍 Pre-push verification: checking deployment documentation..."
echo ""

if ! npm run docs:verify; then
  echo ""
  echo "❌ PRE-PUSH BLOCKED: Deployment documentation verification failed"
  echo "   Fix the issues above and try again."
  exit 1
fi

echo ""
echo "✅ Pre-push verification passed. Proceeding with push..."
exit 0
