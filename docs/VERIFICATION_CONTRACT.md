# Canonical Verification Contract

**Locked:** Code and config files must use the correct Vercel CLI terminology (`vercel (preview)` vs `vercel --prod (production)`) and never the fictional staging/prod flag phrasing. References to the nonexistent `vercel deploy --staging` command are allowed only when explicitly labeled historical/explanatory.

**Scope:** Enforcement applies to code and config files (excludes `.md` and `.sh` documentation/scripts, which may discuss the issue for clarity).

## Quick Run

```bash
npm run docs:verify
```

Expected: Both checks pass ✅

## Canonical Check A: Forbid Fictional Staging/Prod Phrasing

```bash
rg -n '\-\-staging vs \-\-prod' -S . --type-not=sh --type-not=md
```

Expected: no output (exit code 1)

**Rule:** Code and config files must describe staging/production deployments as `vercel (preview) vs vercel --prod (production)`, never the fictional flag phrasing.

**Exemption:** Documentation (`.md`) and scripts (`.sh`) may discuss the issue for educational/historical purposes.

## Canonical Check B: Forbid Unlabeled Historical Commands

```bash
rg -n 'vercel deploy --staging' -S . --type-not=sh --type-not=md | rg -v '(Old|incorrect|Before|Original|Documentation showed|Suggested|doesn'\''t exist)'
```

Expected: no output (exit code 1)

**Rule:** The nonexistent `vercel deploy --staging` command may appear only in documentation or scripts, or when explicitly labeled as historical/explanatory in code comments.

**Allowed labels:** `Old`, `incorrect`, `Before`, `Original`, `Documentation showed`, `Suggested`, `doesn't exist`

## Integration

Added to `package.json`:
```json
{
  "scripts": {
    "docs:verify": "bash scripts/verification-contract.sh"
  }
}
```

### CI Integration

Add to your CI/CD pipeline to prevent reintroduction:

```bash
npm run docs:verify || exit 1
```

If the check fails, the build/PR fails. This ensures the contract is enforced automatically.

## Current Status

✅ Check A: No fictional staging/prod phrasing in code/config (zero matches)
✅ Check B: All historical command references are labeled or excluded (zero unlabeled matches)

**Contract:** LOCKED ✅
