#!/usr/bin/env bash
set -euo pipefail

roadmap_file="ROADMAP.md"
checklist_file="docs/U2_U3_READINESS_CHECKLIST.md"

if [[ ! -f "$roadmap_file" ]]; then
  echo "❌ Missing $roadmap_file"
  exit 1
fi

if [[ ! -f "$checklist_file" ]]; then
  echo "❌ Missing $checklist_file"
  exit 1
fi

if ! grep -q 'U3: BLOCKED UNTIL U2 ENFORCED' "$roadmap_file"; then
  echo "❌ U3 prerequisite drift: ROADMAP.md must keep 'U3: BLOCKED UNTIL U2 ENFORCED'"
  exit 1
fi

if ! grep -q 'U2 Proof Gate (Required Before U3 Work)' "$checklist_file"; then
  echo "❌ Checklist drift: expected U2 proof gate section in $checklist_file"
  exit 1
fi

echo "U3 prerequisite guard passed ✅"
