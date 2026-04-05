# Credential Closure Decision

**Date:** 2026-04-04
**Author:** Michael J. Meraw
**Status:** Intentionally deferred until RevisionGrade go-live

---

## Known Risk (Accepted)

Until credential refresh is completed:

- Supabase-backed migration and contract tests will fail in CI
- Proof-gate enforcement will not validate DB-layer behavior on `main`
- This does not affect application runtime or non-database CI paths.

This risk is explicitly accepted as part of pre-launch staging posture.

---

## Summary

We are done with code; the only remaining red is a deliberately deferred credential issue, to be resolved at go-live.

Credential refresh is deferred to avoid rotating production-adjacent secrets prior to RevisionGrade go-live.

---

## Current State

- **Proof-gate workflow logic is complete**
- **DB password derivation from `SUPABASE_DB_URL_CI` is implemented and functioning as intended**
- The remaining red in `Supabase-Backed Job Tests` is **not** a workflow/code defect
- The remaining failure is a **known deferred credential-validity issue** (postgres authentication rejected by Supabase with current stored DB credentials)

---

## Decision

- **No further code changes required now**
- **No secret refresh until launch**
- Treat current DB-auth failure as an accepted pre-launch environment limitation
- Revisit by updating `SUPABASE_DB_URL_CI` and/or `SUPABASE_DB_PASSWORD_CI` at go-live
- No further PRs required for Finalizer / CI / governance layers
- This decision is final unless go-live timing or infrastructure scope materially changes

---

## Classification

| Dimension | Status |
|---|---|
| Engineering | **Complete** |
| Governance | **Complete** |
| Credential provisioning | **Deferred by choice** |
| Code blocker | **None** |
| Production-grade CI blocker | Credential refresh at go-live |

---

## Go-Live Checklist

When ready to launch RevisionGrade:

1. Go to Supabase Dashboard → Project Settings → Database
2. Copy the current connection string (with valid password)
3. Update `SUPABASE_DB_URL_CI` in GitHub → Settings → Secrets → Actions
4. Optionally add `SUPABASE_DB_PASSWORD_CI` as a standalone secret
5. Re-run Job System CI on main
6. Confirm all-green
7. Verify `Supabase-Backed Job Tests` passes
8. Verify `Enforce Proof Gates on Main` remains green with proof execution active
