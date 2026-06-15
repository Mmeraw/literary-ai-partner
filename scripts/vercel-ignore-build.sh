#!/usr/bin/env bash
set -euo pipefail

# Vercel Ignored Build Step helper.
# Configure this script in Vercel Project Settings → Git → Ignored Build Step:
#   bash scripts/vercel-ignore-build.sh
#
# Exit 0 = skip this Vercel build.
# Exit 1 = continue this Vercel build.
#
# Cost-control policy:
# - Always build production main.
# - Allow an explicitly approved staging branch.
# - Skip all other branch/PR preview builds unless FORCE_VERCEL_BUILD=1.

BRANCH="${VERCEL_GIT_COMMIT_REF:-}"
ENVIRONMENT="${VERCEL_ENV:-}"
FORCE="${FORCE_VERCEL_BUILD:-0}"
STAGING_BRANCH="${VERCEL_STAGING_BRANCH:-staging}"

if [[ "$FORCE" == "1" || "$FORCE" == "true" ]]; then
  echo "FORCE_VERCEL_BUILD enabled; continuing build."
  exit 1
fi

if [[ "$ENVIRONMENT" == "production" || "$BRANCH" == "main" ]]; then
  echo "Production/main deployment; continuing build."
  exit 1
fi

if [[ -n "$STAGING_BRANCH" && "$BRANCH" == "$STAGING_BRANCH" ]]; then
  echo "Approved staging branch '$STAGING_BRANCH'; continuing build."
  exit 1
fi

echo "Skipping Vercel preview build for branch '$BRANCH' in environment '$ENVIRONMENT'."
exit 0
