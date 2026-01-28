#!/usr/bin/env python3
"""Set GitHub secrets using the gh CLI directly."""

import subprocess
import sys

secrets = {
    "SUPABASE_URL": "https://xtumxjnzdswuumndcbwc.supabase.co",
    "SUPABASE_SERVICE_ROLE_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dW14am56ZHN3dXVtbmRjYndjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODA3OTIzMiwiZXhwIjoyMDgzNjU1MjMyfQ.um7tTqt2L5QfaCYnW_xyZ8X8M8OqWLa6IECmEh2cnUE",
    "SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dW14am56ZHN3dXVtbmRjYndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNzkyMzIsImV4cCI6MjA4MzY1NTIzMn0.m0QtTpo3_9jNHCd4t3XCFwMk33DYATzE8cs6QvVYVyU",
    "NEXT_PUBLIC_SUPABASE_URL": "https://xtumxjnzdswuumndcbwc.supabase.co",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dW14am56ZHN3dXVtbmRjYndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNzkyMzIsImV4cCI6MjA4MzY1NTIzMn0.m0QtTpo3_9jNHCd4t3XCFwMk33DYATzE8cs6QvVYVyU",
}

print("🔐 Setting GitHub Secrets\n")

for key, value in secrets.items():
    print(f"Setting {key}...", end=" ")
    try:
        result = subprocess.run(
            ["gh", "secret", "set", key],
            input=value,
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            print("✅")
        else:
            print(f"⚠️  ({result.stderr.strip()})")
    except subprocess.TimeoutExpired:
        print("⏱️  (timeout)")
    except Exception as e:
        print(f"❌ {e}")

print("\n✅ All secrets set!")
print("Trigger CI with: git commit --allow-empty -m 'Trigger CI' && git push origin main")
