# Phase 2E — Canonical user_id RLS migrations ✅ LOCKED

**Status:** ✅ LOCKED  
**Date:** 2026-02-11  
**Evidence Anchor:** [`7c37c60`](https://github.com/Mmeraw/literary-ai-partner/commit/7c37c60) — docs(phase2e): record canonical user_id RLS migrations + proof  
**Governance:** [phase2e-evidence.yml](.github/workflows/phase2e-evidence.yml) (CI verification gate)

## Scope: Canonical user_id Enforcement

Enforce canonical `user_id` field (mapped to `auth.uid()`) across all Row-Level Security (RLS) policies to ensure strict user isolation.

## Acceptance Criteria Checklist

- ✅ RLS policies reference canonical `user_id = auth.uid()` (verified via CI/workflow)
- ✅ All downstream policies cascade user isolation correctly
- ✅ Evidence gate workflow passes on main branch
- ✅ Closure commit locked (no further modifications without new phase)

## Evidence

**Canonical Policies Verified:**
- `manuscripts` policies reference `user_id = auth.uid()`
- `manuscript_chunks` policy validates parent `manuscripts.user_id = auth.uid()`
- `evaluation_artifacts` policy validates job → manuscript user isolation chain

**Gate Status:**
- CI Workflow: `.github/workflows/phase2e-evidence.yml` 
- Verification: RLS policy enforcement via Supabase API
- Artifact: `phase2e-evidence-{commit}.log` (uploaded per gate run)

**Run Evidence (GitHub Actions):**
- **Latest Pass:** [Run #21938309509](https://github.com/Mmeraw/literary-ai-partner/actions/runs/21938309509)
- **Status:** ✅ Success (2026-02-12T08:01:25Z)
- **Commit:** `daefcfa` (locked closure commit)
- **Evidence Artifact:** [phase2e-evidence-daefcfad185c955deae0f6dcfcc4fb55ad78647a.zip](https://github.com/Mmeraw/literary-ai-partner/actions/runs/21938309509/artifacts/5478732575)

**How to Re-Run Verification:**
```bash
# Manual trigger of Phase 2E evidence gate
gh workflow run phase2e-evidence.yml --ref main

# Or: push changes to paths watched by phase2e-evidence.yml
# - .github/workflows/phase2e-evidence.yml
# - supabase/migrations/**
# - PHASE2E_STATUS.md
```

**View Recent Runs:**
```bash
# List all Phase 2E evidence gate runs
gh run list --workflow phase2e-evidence.yml

# View specific run logs
gh run view 21938309509 --log
```

## Closed

This phase is **locked at commit `7c37c60`**. No further work is planned. New RLS policy changes require a new phase with explicit governance tracking.
