# Evaluation Jobs - Canonical Enum Values

**Source of Truth**: Database check constraints in [`supabase/migrations/20260117060042_remote_schema.sql`](../supabase/migrations/20260117060042_remote_schema.sql)

These values are **enforced at the database level** via CHECK constraints. Any INSERT or UPDATE that violates these constraints will fail with a constraint violation error.

## Required NOT NULL Fields

When creating an `evaluation_jobs` record, these fields are required:

| Field | Type | Constraint | Required |
|-------|------|------------|----------|
| `policy_family` | TEXT | `chk_eval_jobs_policy_family` | ✅ NOT NULL |
| `voice_preservation_level` | TEXT | `chk_eval_jobs_voice_preservation_level` | ✅ NOT NULL |
| `english_variant` | TEXT | `chk_eval_jobs_english_variant` | ✅ NOT NULL |

## Allowed Values

### policy_family

**Check Constraint**: `chk_eval_jobs_policy_family`

```sql
CHECK (policy_family = ANY (ARRAY['standard'::text, 'dark_fiction'::text, 'trauma_memoir'::text]))
```

**Allowed values**:
- `'standard'` ← **Default/Canonical**
- `'dark_fiction'`
- `'trauma_memoir'`

### voice_preservation_level

**Check Constraint**: `chk_eval_jobs_voice_preservation_level`

```sql
CHECK (voice_preservation_level = ANY (ARRAY['strict'::text, 'balanced'::text, 'expressive'::text]))
```

**Allowed values**:
- `'strict'`
- `'balanced'` ← **Default/Canonical**
- `'expressive'`

### english_variant

**Check Constraint**: `chk_eval_jobs_english_variant`

```sql
CHECK (english_variant = ANY (ARRAY['us'::text, 'uk'::text, 'ca'::text, 'au'::text]))
```

**Allowed values**:
- `'us'` ← **Default/Canonical**
- `'uk'`
- `'ca'`
- `'au'`

## Canonical Default Values

For test scripts and seed data, use these **canonical defaults**:

```sql
policy_family = 'standard'
voice_preservation_level = 'balanced'
english_variant = 'us'
```

## Example INSERT

```sql
INSERT INTO public.evaluation_jobs (
  manuscript_id,
  job_type,
  policy_family,
  voice_preservation_level,
  english_variant,
  status
)
VALUES (
  1,
  'full_evaluation',
  'standard',     -- ✅ Valid
  'balanced',     -- ✅ Valid
  'us',           -- ✅ Valid
  'queued'
);
```

## Common Mistakes

❌ **WRONG** - These will fail with constraint violations:

```sql
-- NULL values (NOT NULL constraint)
policy_family = NULL
voice_preservation_level = NULL

-- Invalid enum values
policy_family = 'huhu'           -- Not in allowed set
voice_preservation_level = 'standard'  -- Wrong field (belongs to policy_family)
english_variant = 'en'           -- Not in allowed set (use 'us')
```

## Script Guardrails

Test scripts include guardrails to prevent invalid values:

```bash
# Canonical job field values (aligned with DB constraints)
POLICY_FAMILY="${POLICY_FAMILY:-standard}"
VOICE_LEVEL="${VOICE_LEVEL:-balanced}"
ENGLISH_VARIANT="${ENGLISH_VARIANT:-us}"

# Fail fast if invalid values provided
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

## Diagnostic Query

To verify allowed values directly from the database:

```sql
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'evaluation_jobs'
  AND conname IN (
    'chk_eval_jobs_policy_family',
    'chk_eval_jobs_voice_preservation_level',
    'chk_eval_jobs_english_variant'
  );
```

## Status

✅ **Schema locked** - Phase 2A/2B/2D canon-locked  
✅ **Test scripts updated** - Guardrails added  
✅ **Seed data fixed** - Uses canonical values  
✅ **Documentation complete** - This file

---

**Last Updated**: 2026-01-27  
**Schema Version**: `20260117060042_remote_schema.sql`
