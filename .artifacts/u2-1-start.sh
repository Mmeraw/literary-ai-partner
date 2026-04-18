#!/usr/bin/env bash
set -euo pipefail

cd /workspaces/literary-ai-partner

echo "== pre-flight grep: identify Pass 1 incompleteness signals =="
grep -rnE "INCOMPLETE|WEAK" lib/evaluation/pipeline --include='*.ts' | head -20 || true
grep -rnE "incomplete_reasons|weakness_flags|warnings" lib/evaluation --include='*.ts' | head -20 || true

echo
echo "== create branch =="
git checkout -b feat/u2-1-pass1-incompleteness-propagation

echo
echo "Next manual step: open the U2.1 issue with .artifacts/u2-1-issue.md"
