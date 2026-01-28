# GitHub Secrets - Manual Configuration Required

The `gh` CLI has permission/interaction issues in this environment. Please set these secrets manually via the GitHub UI:

## 🔐 Required Secrets

Go to: **https://github.com/Mmeraw/literary-ai-partner/settings/secrets/actions**

Click **"New repository secret"** and add each one:

### 1. SUPABASE_ANON_KEY
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dW14am56ZHN3dXVtbmRjYndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNzkyMzIsImV4cCI6MjA4MzY1NTIzMn0.m0QtTpo3_9jNHCd4t3XCFwMk33DYATzE8cs6QvVYVyU
```

### 2. NEXT_PUBLIC_SUPABASE_ANON_KEY
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dW14am56ZHN3dXVtbmRjYndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNzkyMzIsImV4cCI6MjA4MzY1NTIzMn0.m0QtTpo3_9jNHCd4t3XCFwMk33DYATzE8cs6QvVYVyU
```

### 3. NEXT_PUBLIC_SUPABASE_URL
```
https://xtumxjnzdswuumndcbwc.supabase.co
```

### 4. SUPABASE_URL (Update if needed)
```
https://xtumxjnzdswuumndcbwc.supabase.co
```

### 5. SUPABASE_SERVICE_ROLE_KEY (Update if needed)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dW14am56ZHN3dXVtbmRjYndjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODA3OTIzMiwiZXhwIjoyMDgzNjU1MjMyfQ.um7tTqt2L5QfaCYnW_xyZ8X8M8OqWLa6IECmEh2cnUE
```

## ✅ After Setting Secrets

Once you've added all 5 secrets in GitHub, trigger a new workflow run:

```bash
cd /workspaces/literary-ai-partner
git commit --allow-empty -m "Trigger Phase 2D Evidence Gate"
git push origin main
```

The Phase 2D Evidence Gate will then run and all 4 tests should pass ✅
