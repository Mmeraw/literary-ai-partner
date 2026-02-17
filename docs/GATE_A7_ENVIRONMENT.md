# Gate A7 — Environment Variables

Required environment variables for Gate A7 share functionality.

---

## Required Variables

### REPORT_SHARE_HMAC_SECRET

**Purpose:** Secret key for HMAC-SHA256 hashing of share tokens.

**Security:**
- MUST be cryptographically random (32+ bytes recommended)
- MUST be kept secret (never commit to source control)
- MUST be different per environment (dev/staging/prod)

**Generate:**
```bash
# Generate a secure random secret
openssl rand -base64 32
```

**Set in Vercel/hosting:**
```bash
# Add as environment variable in your hosting platform
REPORT_SHARE_HMAC_SECRET=<your-secret-here>
```

**Local development:**
```bash
# Add to .env.local (gitignored)
REPORT_SHARE_HMAC_SECRET=<your-secret-here>
```

---

### NEXT_PUBLIC_APP_URL

**Purpose:** Base URL for constructing share links.

**Examples:**
- Production: `https://revisiongrade.com`
- Staging: `https://staging.revisiongrade.com`
- Local: `http://localhost:3000`

**Set in Vercel/hosting:**
```bash
NEXT_PUBLIC_APP_URL=https://revisiongrade.com
```

**Local development:**
```bash
# Add to .env.local
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Optional Variables

### SHARE_DEFAULT_EXPIRES_DAYS

**Purpose:** Default expiration time for share links (in days).

**Default:** 14 days

**Example:**
```bash
SHARE_DEFAULT_EXPIRES_DAYS=30
```

---

## Security Checklist

Before deploying A7:

- [ ] `REPORT_SHARE_HMAC_SECRET` is set in all environments
- [ ] Secret is cryptographically random (not a weak password)
- [ ] Secret is different per environment
- [ ] Secret is stored securely (e.g., Vercel environment variables)
- [ ] `NEXT_PUBLIC_APP_URL` matches actual deployment URL
- [ ] `.env.local` is in `.gitignore` (prevent accidental commits)

---

## Rotation Policy

If `REPORT_SHARE_HMAC_SECRET` must be rotated:

1. **Set new secret** in environment
2. **Old shares become invalid** (hashes won't match)
3. **Users must recreate shares** after rotation

This is by design (fail-closed).

Alternative: Support two secrets temporarily (old + new) during rotation period.
