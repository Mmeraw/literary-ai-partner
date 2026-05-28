# Set GitHub Secrets - PRODUCTION Keys

Go to: https://github.com/Mmeraw/literary-ai-partner/settings/secrets/actions

Click "Update" (or "New repository secret") for each:

---

## 1. SUPABASE_URL
Copy the Supabase project URL from your Supabase dashboard (Settings → API).

---

## 2. NEXT_PUBLIC_SUPABASE_URL
Same value as SUPABASE_URL above.

---

## 3. SUPABASE_SERVICE_ROLE_KEY
Copy the **service_role** key from your Supabase dashboard (Settings → API → Project API keys).

⚠️ **NEVER commit this key to the repository.** It bypasses Row Level Security.

---

## 4. SUPABASE_ANON_KEY
Copy the **anon/public** key from your Supabase dashboard (Settings → API → Project API keys).

---

## 5. NEXT_PUBLIC_SUPABASE_ANON_KEY
Same value as SUPABASE_ANON_KEY above.

---

**All values are sourced from the Supabase dashboard for the PRODUCTION project.**

After updating all 5, trigger CI:
```bash
git commit --allow-empty -m "test: verify secrets" && git push
```

> **Security note:** The keys that were previously hardcoded in this file have been
> rotated. If you have not yet rotated them, do so immediately via the Supabase
> dashboard (Settings → API → Regenerate keys).
