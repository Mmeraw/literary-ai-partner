# D1 Secret Setup & Password Rotation

**Status**: Critical setup required before CI execution  
**Owner**: DevOps / Infrastructure  
**Last Updated**: 2026-02-08

---

## ⚠️ Password Rotation (URGENT)

If credentials were shared in chat, logs, or code comments, **immediately rotate the password**:

1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **Settings → Database → Users**
3. Find the `postgres` user
4. Click **Reset password**
5. Generate a new secure password
6. Copy the new password (you'll need it in the next steps)

**Old credential is now invalid and permissionless.**

---

## URL-Encoding Special Characters

GitHub Actions does **NOT** auto-encode secrets. If your password contains special characters, you must percent-encode them before storing in GitHub.

### Common Characters to Encode

| Character | Encoded | Example |
|-----------|---------|---------|
| `#` | `%23` | `Brandy45%23` |
| `@` | `%40` | `user%40domain` |
| `:` | `%3A` | `pass%3Aword` |
| `/` | `%2F` | `path%2Fto%2Ffile` |
| `?` | `%3F` | `value%3F` |
| `&` | `%26` | `key%26value` |
| `=` | `%3D` | `var%3Dvalue` |

### URL Encoding Helper (bash)

```bash
#!/bin/bash
# URL-encode a string
urlencode() {
    local string="${1}"
    echo -n "$string" | od -An -tx1 | tr ' ' % | tr -d '\n'
}

# Example: encode the password
password="Brandy45#"
encoded=$(urlencode "$password")
echo "Encoded: $encoded"
# Output: Encoded: 42%72%61%6e%64%79%34%35%23
```

Or use Python:
```python
import urllib.parse
password = "Brandy45#"
encoded = urllib.parse.quote(password, safe='')
print(f"Encoded: {encoded}")
# Output: Encoded: Brandy45%23
```

---

## Store URL-Encoded Secret in GitHub

### Step 1: Build the Full Connection String

Copy the connection string from Supabase Dashboard and replace the password with the URL-encoded version.

**Format**:
```
postgresql://postgres:PASSWORD@db.xtumxjnzdswuumndcbwc.supabase.co:5432/postgres?sslmode=require
```

**Example with encoding**:
```
postgresql://postgres:Brandy45%23@db.xtumxjnzdswuumndcbwc.supabase.co:5432/postgres?sslmode=require
                       ^^^^^^^^^ URL-encoded password
```

### Step 2: Store in GitHub Secrets

1. Go to your GitHub repository
2. Settings → Secrets and variables → **Actions**
3. Click **New repository secret**
4. **Name**: `SUPABASE_DB_URL_CI`
5. **Value**: `postgresql://postgres:Brandy45%23@db.xtumxjnzdswuumndcbwc.supabase.co:5432/postgres?sslmode=require`
6. Click **Add secret**

### Step 3: Verify Secret Creation

```bash
# In the GitHub Actions workflow, you can log the redacted version:
gh secret view SUPABASE_DB_URL_CI | sed 's/:[^@]*@/:\*\*\*@/'
# Output: postgresql://***@db.xtumxjnzdswuumndcbwc.supabase.co:5432/postgres?sslmode=require
```

---

## Why This Matters

### Problem: Raw Special Characters in Secrets

If you store `postgresql://postgres:Brandy45#@...` in GitHub:
- Python `urlparse` sees `#` as a fragment delimiter
- Tools may misinterpret the rest of the URL as a fragment, not a password
- Connection strings become ambiguous and unparseable

Example failure:
```python
import urllib.parse
url = "postgresql://postgres:Brandy45#@db.xtumxjnzdswuumndcbwc.supabase.co:5432/postgres"
p = urllib.parse.urlparse(url)
# ERROR: password contains # → parsed as fragment, password extraction fails
```

### Solution: Pre-Encoded URL

With `postgresql://postgres:Brandy45%23@...`:
- Every tool (Python, Node, psql, bash) sees `%23` as a literal sequence
- No ambiguity; password is unambiguously `Brandy45#`
- All parsers agree on the same interpretation

---

## Port Selection: 5432 vs 6543

- **5432** (direct connection): Recommended for CI scripts and admin queries
  - Long-lived sessions, full feature support
  - Good for proof queries and batch operations

- **6543** (transaction pooler / Supavisor): For serverless/stateless workloads
  - Higher concurrency, shorter sessions
  - Not ideal for admin queries

**For D1 proof**: Use **5432**.

---

## Next Steps

1. ✅ Rotate password in Supabase Dashboard (invalidate old credential)
2. ✅ URL-encode the new password
3. ✅ Build full connection string with encoded password
4. ✅ Store in GitHub as `SUPABASE_DB_URL_CI` secret
5. ✅ Update `.github/workflows/phase-c-d1-proof.yml` with getent diagnostic step (see [PHASE_C_D1_CI_RUNBOOK.md](PHASE_C_D1_CI_RUNBOOK.md))
6. ✅ Trigger workflow and check CI logs for IPv4 reachability

---

## Verification Checklist

- [ ] Old password rotated in Supabase
- [ ] New password URL-encoded (special chars → %XX)
- [ ] Full connection string built with encoded password
- [ ] Secret stored in GitHub as `SUPABASE_DB_URL_CI`
- [ ] GitHub Actions workflow includes getent diagnostic step
- [ ] CI logs show IPv4 or IPv6 reachability result
- [ ] D1 proof script executes and returns exit code 0 or 1

---

## References

- [Supabase Connection Strings](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [URL Encoding (Percent-Encoding)](https://developer.mozilla.org/en-US/docs/Glossary/percent-encoding)
- [PostgreSQL JDBC URL Format](https://jdbc.postgresql.org/documentation/head/connect.html) (reference for reserved characters)
