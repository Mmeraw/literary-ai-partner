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

# PR body compliance check — only if a PR already exists for this branch.
# Override with SKIP_PR_BODY_CHECK=1.
if [ "${SKIP_PR_BODY_CHECK:-0}" = "1" ]; then
  echo "⏭  Skipping PR body compliance check (SKIP_PR_BODY_CHECK=1)."
elif ! command -v gh >/dev/null 2>&1; then
  echo "⏭  Skipping PR body compliance check (gh CLI not installed)."
else
  PR_NUM="$(gh pr view --json number --jq .number 2>/dev/null || true)"
  if [ -n "${PR_NUM}" ]; then
    echo ""
    echo "🔍 PR body compliance check (PR #${PR_NUM})..."
    if ! node scripts/validate-pr-body.mjs --pr "${PR_NUM}"; then
      echo ""
      echo "❌ PRE-PUSH BLOCKED: PR #${PR_NUM} body fails enforce-latency-template."
      echo "   Run 'npm run pr:check' and fix the missing tokens, or set SKIP_PR_BODY_CHECK=1 to bypass."
      exit 1
    fi
  else
    echo "⏭  No PR found for current branch — skipping PR body compliance check."
  fi
fi

echo ""
echo "✅ Pre-push verification passed. Proceeding with push..."
exit 0
