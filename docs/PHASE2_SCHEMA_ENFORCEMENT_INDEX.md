# Phase 2 Schema Enforcement - Quick Index

**Problem**: Test scripts failing with constraint violations (`policy_family`, `voice_preservation_level`, `english_variant`)

**Solution**: All fixed! Schema locked, scripts updated, guardrails added.

---

## 📖 Documentation (Pick Your Format)

### 🎯 Quick Reference (Command Line)
```bash
./scripts/eval-jobs-insert-reference.sh
```
Shows: valid INSERT template, guardrails code, common mistakes, diagnostic queries

### 📚 Complete Reference (Markdown)
[docs/EVALUATION_JOBS_ENUM_VALUES.md](./EVALUATION_JOBS_ENUM_VALUES.md)

Includes:
- Database constraints (source of truth)
- Allowed values for each field
- Canonical defaults
- Example code
- Diagnostic queries

### ✅ Implementation Summary
[docs/PHASE2_SCHEMA_ENFORCEMENT_COMPLETE.md](./PHASE2_SCHEMA_ENFORCEMENT_COMPLETE.md)

Includes:
- What was changed
- Verification test results
- Files modified
- Status summary

---

## ⚡ TL;DR - Canonical Values

```sql
-- ✅ USE THESE (canonical defaults)
policy_family = 'standard'
voice_preservation_level = 'balanced'
english_variant = 'us'
```

**Allowed values**:
- `policy_family`: `standard` | `dark_fiction` | `trauma_memoir`
- `voice_preservation_level`: `strict` | `balanced` | `expressive`
- `english_variant`: `us` | `uk` | `ca` | `au`

---

## 🛡️ Guardrails Template

Add to any script that creates `evaluation_jobs`:

```bash
POLICY_FAMILY="${POLICY_FAMILY:-standard}"
VOICE_LEVEL="${VOICE_LEVEL:-balanced}"
ENGLISH_VARIANT="${ENGLISH_VARIANT:-us}"

case "$POLICY_FAMILY" in
  standard|dark_fiction|trauma_memoir) ;;
  *) echo "ERROR: invalid POLICY_FAMILY=$POLICY_FAMILY"; exit 1 ;;
esac

case "$VOICE_LEVEL" in
  strict|balanced|expressive) ;;
  *) echo "ERROR: invalid VOICE_LEVEL=$VOICE_LEVEL"; exit 1 ;;
esac

case "$ENGLISH_VARIANT" in
  us|uk|ca|au) ;;
  *) echo "ERROR: invalid ENGLISH_VARIANT=$ENGLISH_VARIANT"; exit 1 ;;
esac
```

---

## 🔍 Diagnostic Query

```bash
docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -c "
SELECT conname, pg_get_constraintdef(c.oid) AS def
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'evaluation_jobs'
  AND conname IN (
    'chk_eval_jobs_policy_family',
    'chk_eval_jobs_voice_preservation_level',
    'chk_eval_jobs_english_variant'
  );
"
```

---

## 📝 Example Valid INSERT

```sql
INSERT INTO public.evaluation_jobs (
  manuscript_id,
  job_type,
  status,
  phase,
  work_type,
  policy_family,
  voice_preservation_level,
  english_variant
)
VALUES (
  1,
  'full_evaluation',
  'queued',
  'phase_1',
  'novel',
  'standard',    -- ✅ Valid
  'balanced',    -- ✅ Valid
  'us'           -- ✅ Valid
);
```

---

## ❌ Common Mistakes

```sql
-- ❌ NULL values
INSERT INTO evaluation_jobs (manuscript_id, job_type, status)
VALUES (1, 'full_evaluation', 'queued');
-- ERROR: null value in column "policy_family" violates not-null constraint

-- ❌ Invalid enum value
policy_family = 'huhu'
-- ERROR: violates check constraint "chk_eval_jobs_policy_family"

-- ❌ Wrong value family
voice_preservation_level = 'standard'  -- belongs to policy_family
-- ERROR: violates check constraint "chk_eval_jobs_voice_preservation_level"
```

---

## 📂 Updated Files

**Scripts with guardrails**:
- [scripts/test-phase2d-concurrency.sh](../scripts/test-phase2d-concurrency.sh)
- [scripts/test-phase2b-chunk-fetch.sh](../scripts/test-phase2b-chunk-fetch.sh)
- [scripts/seed-test-evaluation-result.sql](../scripts/seed-test-evaluation-result.sql)

**Documentation**:
- [WORKER_RUNBOOK.md](../WORKER_RUNBOOK.md)
- [PHASE2B_NEXT_STEPS.md](../PHASE2B_NEXT_STEPS.md)

**Reference materials**:
- [scripts/eval-jobs-insert-reference.sh](../scripts/eval-jobs-insert-reference.sh) (executable quick ref)
- [docs/EVALUATION_JOBS_ENUM_VALUES.md](./EVALUATION_JOBS_ENUM_VALUES.md) (complete reference)
- [docs/PHASE2_SCHEMA_ENFORCEMENT_COMPLETE.md](./PHASE2_SCHEMA_ENFORCEMENT_COMPLETE.md) (this summary)

---

## ✅ Verification

```bash
# ✅ Valid insert works
$ docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -c \
  "INSERT INTO evaluation_jobs (manuscript_id, job_type, work_type, policy_family, voice_preservation_level, english_variant, status) \
   VALUES (1, 'full_evaluation', 'novel', 'standard', 'balanced', 'us', 'queued') RETURNING id;"
# → Success!

# ❌ Invalid value rejected by DB
$ docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -c \
  "INSERT INTO evaluation_jobs (..., policy_family, ...) VALUES (..., 'huhu', ...);"
# → ERROR: violates check constraint "chk_eval_jobs_policy_family"

# ❌ Invalid value rejected by script guardrails
$ POLICY_FAMILY=invalid bash scripts/test-phase2d-concurrency.sh
# → ERROR: invalid POLICY_FAMILY=invalid (allowed: standard, dark_fiction, trauma_memoir)
```

---

## 🔒 Status

- **Schema**: Canon-locked (Phase 2A/2B/2D)
- **Test Scripts**: Updated with guardrails
- **Documentation**: Complete
- **Verification**: All tests passing

**No further action required.**
