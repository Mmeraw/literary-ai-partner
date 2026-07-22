#!/bin/sh
# Vercel "Ignored Build Step" script.
# Exit 0 => skip the build. Exit 1 => continue building.
# https://vercel.com/docs/project-configuration/vercel-json#ignorecommand

# A production deployment must always build so configuration-only changes,
# including rotated runtime secrets, take effect.
if [ "${VERCEL_ENV:-}" = "production" ]; then
  echo "Building production deployment."
  exit 1
fi

if [ "$VERCEL_GIT_COMMIT_REF" != "main" ]; then
  echo "Skipping non-main preview build for branch: ${VERCEL_GIT_COMMIT_REF:-<unknown>}"
  exit 0
fi

# On main, only skip if the diff touches only docs/markdown/GitHub files.
git diff --quiet HEAD^ HEAD -- . ':!docs' ':!*.md' ':!.github'
