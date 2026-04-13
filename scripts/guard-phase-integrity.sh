#!/usr/bin/env bash
set -euo pipefail

echo "[guard-phase-integrity] start"

# Governance policy: keep signing config in allowed state for CI/runtime parity.
node scripts/check-gpg-disabled.js

# Regression lock: queued phase_2 must never re-enter phase_1 processor path.
npx jest --runInBand __tests__/lib/evaluation/processor.phase-routing.test.ts

# Auth lock: worker auth matrix including dev-only service-role gate behavior.
npx jest --runInBand app/api/workers/process-evaluations/auth.test.ts

echo "[guard-phase-integrity] OK"
