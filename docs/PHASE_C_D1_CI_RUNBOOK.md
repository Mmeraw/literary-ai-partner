# D1 Proof: GitHub Actions Runbook

**Purpose**: How to execute and capture D1 proof evidence in CI  
**Status**: Reference (optional; can also run locally)

---

## Local Execution (DevOps)

```bash
# Encode password if needed (e.g., # → %23)
# Example: password "Brandy45#" becomes "Brandy45%23" in the URL

# Set Supabase credentials (from .env or env export, already URL-encoded)
export SUPABASE_DB_URL_CI="postgresql://postgres:Brandy45%23@db.xtumxjnzdswuumndcbwc.supabase.co:5432/postgres?sslmode=require"

# Run proof script
./scripts/phase-c-d1-proof.sh

# Capture output to evidence archive
./scripts/phase-c-d1-proof.sh 2>&1 | tee evidence/phase-c/d1/proof-$(date -u +%Y%m%dT%H%M%SZ).log
```

---

## Pre-Requisite: Secret Setup

### 🔐 Password Rotation (URGENT)  
If credentials were posted in chat or logs, rotate the password immediately in Supabase Dashboard. The old credential is now invalid.

### Store URL-Encoded Connection String

**GitHub does NOT auto-encode secrets.** Store the password already URL-encoded.

Example:
```
SUPABASE_DB_URL_CI = postgresql://postgres:Brandy45%23@db.xtumxjnzdswuumndcbwc.supabase.co:5432/postgres?sslmode=require
                                             ^^^^^ (# encoded as %23)
```

**All non-alphanumeric password characters must be percent-encoded**:
- `#` → `%23`
- `@` → `%40`
- `:` → `%3A`
- etc.

Steps:
1. Open Supabase Dashboard → Settings → Database → Connection String
2. Copy the URL and manually encode any special chars in the password
3. Go to GitHub → Settings → Secrets and variables → Actions
4. Create/Update `SUPABASE_DB_URL_CI` with the URL-encoded version
5. Save and verify

---

## CI Integration (GitHub Actions)

Add to `.github/workflows/phase-c-d1-proof.yml`:

```yaml
name: Phase C D1 - Failure Envelope Proof

on:
  workflow_dispatch:  # Trigger manually when ready
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC

jobs:
  d1-proof:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout repo
        uses: actions/checkout@v4

      - name: Diagnose DNS & Network Reachability
        run: |
          echo "=== Testing IPv4 and IPv6 reachability to Supabase ==="
          
          # Test IPv4
          echo "Testing IPv4..."
          getent ahostsv4 db.xtumxjnzdswuumndcbwc.supabase.co || echo "No IPv4 found"
          
          # Test IPv6
          echo "Testing IPv6..."
          getent ahostsv6 db.xtumxjnzdswuumndcbwc.supabase.co || echo "No IPv6 found"
          
          # Summary
          echo ""
          echo "Note: GitHub Actions runners are IPv4-only."
          echo "If only IPv6 is returned, the connection will fail."
          echo "In that case, migrate to self-hosted runner or wait for Supabase IPv4 availability."

      - name: Run D1 proof query
        env:
          SUPABASE_DB_URL_CI: ${{ secrets.SUPABASE_DB_URL_CI }}
        run: |
          chmod +x ./scripts/phase-c-d1-proof.sh
          ./scripts/phase-c-d1-proof.sh
        
      - name: Capture evidence
        if: success()
        run: |
          mkdir -p evidence/phase-c/d1
          echo "D1 Status: PASS ($(date -u +%Y-%m-%dT%H:%M:%SZ))" >> evidence/phase-c/d1/status.txt
          
      - name: Fail if violations found
        if: failure()
        run: |
          echo "❌ D1 Proof failed: envelope contract violated"
          exit 1

      - name: Archive evidence
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: phase-c-d1-evidence
          path: evidence/phase-c/d1/
          retention-days: 90
```

---

## Evidence Capture

Once proof script runs successfully:

```bash
# Create evidence directory
mkdir -p evidence/phase-c/d1

# Run proof and capture output
./scripts/phase-c-d1-proof.sh 2>&1 | tee evidence/phase-c/d1/proof-$(date -u +%Y%m%dT%H%M%SZ).log

# Verify the log was created
ls -la evidence/phase-c/d1/

# Commit to repository (or keep as artifact)
git add evidence/phase-c/d1/
git commit -m "docs: D1 failure envelope proof (phase-c)"
git push origin main
```

---

## Updating Evidence Pack

Once proof is executed, update `PHASE_C_EVIDENCE_PACK.md`:

```markdown
## D1 Evidence Capture Template

**Date Completed**: 2026-02-08  
**Executed By**: DevOps Team / CI  
**Result**: PASS ✅

**Proof Output**:
```
✅ D1 PASS: All failed jobs have required envelope fields

D1 Acceptance Criteria Met:
  [✅] Spec exists (FAILURE_ENVELOPE_v1.md)
  [✅] Runtime wiring verified (mapDbRowToJob())
  [✅] Proof query clean (0 violations)
  [✅] Evidence captured

D1 Status: ✅ DONE
```

**Evidence Archive**: `evidence/phase-c/d1/proof-2026-02-08T*.log`

**D1 Status**: ✅ DONE
```

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `SUPABASE_DB_URL_CI not set` | Env var not exported | Verify GitHub Secret is created and referenced in step env |
| `Connection refused` / `Network is unreachable` | Invalid credentials or network issue | Check URL encoding (# → %23); verify secret in GitHub |
| `getent shows IPv6 only; psql fails` | GitHub runner is IPv4-only but DNS resolves only to IPv6 | **This is the IPv6 routing issue.** See IPv6 resolution (next section) |
| Q0 returns > 0 | Legacy or broken write paths exist | See drill-down output; fix write paths and rerun |

---

## IPv6 Resolution Path

If CI diagnostics show **IPv6 only** and psql fails with "Network is unreachable":

**Option 1: Force IPv4 (if available)**
- Modify Supabase DNS records to include IPv4 (contact Supabase support)
- Update GitHub Actions runner to prefer IPv4 (may not be possible on shared runners)

**Option 2: Use Self-Hosted Runner**
- Set up a self-hosted GitHub Actions runner with IPv6-capable network
- Routes IPv6 traffic and can connect to IPv6-only Supabase hosts
- [GitHub Docs: Self-hosted runners](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners)

**Option 3: Wait for Supabase IPv4 Rollout**
- Supabase is gradually rolling out dual IPv4/IPv6 support
- Check Supabase status page for your cluster's IP family

If you choose Option 1 and Supabase adds IPv4, simply re-run the CI job; no code changes needed.

---
