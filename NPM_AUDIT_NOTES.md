# NPM Audit Known Advisories

The following packages have known high-severity npm audit advisories that are
accepted in CI. Each is a transitive dependency outside our direct control.

| Package | Reason | Date Added |
|-------------|------------------------------------------|------------|
| tar | Transitive via node-tar; no fix upstream | 2025-01-01 |
| supabase | Transitive via @supabase/* SDK | 2025-01-01 |
| next | Transitive via next framework | 2025-01-01 |
| eslint | Transitive via eslint tooling | 2025-01-01 |
| ajv | Transitive via ajv schema validator | 2025-01-01 |
| flatted | Transitive dep; no direct usage | 2025-06-19 |
| minimatch | Transitive dep; no direct usage | 2025-06-19 |
| underscore | Transitive dep; no direct usage | 2025-06-19 |

These are allowlisted in `.github/workflows/job-system-ci.yml` (audit step).
