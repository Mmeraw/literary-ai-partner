# Set GitHub Secrets - PRODUCTION Keys

Go to: https://github.com/Mmeraw/literary-ai-partner/settings/secrets/actions

Click "Update" (or "New repository secret") for each:

---

## 1. SUPABASE_URL
```
https://xtumxjnzdswuumndcbwc.supabase.co
```

---

## 2. NEXT_PUBLIC_SUPABASE_URL
```
https://xtumxjnzdswuumndcbwc.supabase.co
```

---

## 3. SUPABASE_SERVICE_ROLE_KEY
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dW14am56ZHN3dXVtbmRjYndjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODA3OTIzMiwiZXhwIjoyMDgzNjU1MjMyfQ.um7tTqt2L5QfaCYnW_xyZ8X8M8OqWLa6IECmEh2cnUE
```

---

## 4. SUPABASE_ANON_KEY
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dW14am56ZHN3dXVtbmRjYndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNzkyMzIsImV4cCI6MjA4MzY1NTIzMn0.m0QtTpo3_9jNHCd4t3XCFwMk33DYATzE8cs6QvVYVyU
```

---

## 5. NEXT_PUBLIC_SUPABASE_ANON_KEY
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dW14am56ZHN3dXVtbmRjYndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNzkyMzIsImV4cCI6MjA4MzY1NTIzMn0.m0QtTpo3_9jNHCd4t3XCFwMk33DYATzE8cs6QvVYVyU
```

---

**All values sourced from `.env.local` (PRODUCTION project xtumxjnzdswuumndcbwc)**

After updating all 5, trigger CI:
```bash
git commit --allow-empty -m "test: verify secrets" && git push
```
