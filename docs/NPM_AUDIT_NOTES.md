# npm audit note

- Remaining vuln: tar <=7.5.3 via supabase@2.72.8 (GHSA-r6q2-hw4h-h46w).
- Reason: supabase@2.72.8 pins tar@7.5.3; npm audit --force suggests downgrading supabase to 0.5.0 (breaking).
- Impact: advisory references macOS APFS; our CI/dev runs on Linux.
- Action: accept until supabase releases tar>=7.5.4+; re-check monthly.
