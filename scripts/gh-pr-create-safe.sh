#!/usr/bin/env bash
# Safe wrapper around `gh pr create --body-file`.
# Validates the body file with scripts/validate-pr-body.mjs first; only
# invokes gh pr create if validation passes.
#
# Usage:
#   scripts/gh-pr-create-safe.sh --title "..." --body-file path/to/body.md [other gh pr create flags]

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

BODY_FILE=""
PASS_THROUGH=()

while [ "$#" -gt 0 ]; do
  case "$1" in
    --body-file)
      BODY_FILE="$2"
      PASS_THROUGH+=("$1" "$2")
      shift 2
      ;;
    --body-file=*)
      BODY_FILE="${1#--body-file=}"
      PASS_THROUGH+=("$1")
      shift
      ;;
    *)
      PASS_THROUGH+=("$1")
      shift
      ;;
  esac
done

if [ -z "${BODY_FILE}" ]; then
  echo "❌ gh-pr-create-safe.sh: --body-file <path> is required."
  exit 2
fi

if [ ! -f "${BODY_FILE}" ]; then
  echo "❌ gh-pr-create-safe.sh: body file not found: ${BODY_FILE}"
  exit 2
fi

echo "🔍 Validating ${BODY_FILE} against enforce-latency-template..."
if ! node scripts/validate-pr-body.mjs --file "${BODY_FILE}"; then
  echo ""
  echo "❌ gh-pr-create-safe.sh BLOCKED: body file does not satisfy enforce-latency-template."
  echo "   Fix the missing tokens and retry."
  exit 1
fi

echo ""
echo "✅ Body file is compliant. Invoking gh pr create..."
exec gh pr create "${PASS_THROUGH[@]}"
