# CI Integration: Deployment Documentation Verification

Add this to your CI/CD pipeline to prevent reintroduction of dangerous Vercel CLI phrasing.

## GitHub Actions Example

Add to `.github/workflows/ci.yml`:

```yaml
- name: Install ripgrep (verification tool)
  run: |
    if ! command -v rg &> /dev/null; then
      sudo apt-get update && sudo apt-get install -y ripgrep
    fi

- name: Verify deployment documentation
  run: |
    set -euo pipefail
    npm ci
    npm run docs:verify
```

## GitLab CI Example

Add to `.gitlab-ci.yml`:

```yaml
verify-docs:
  before_script:
    - apt-get update && apt-get install -y ripgrep
  script:
    - set -euo pipefail
    - npm ci
    - npm run docs:verify
```

## Jenkins Example

Add to `Jenkinsfile`:

```groovy
stage('Verify Documentation') {
  steps {
    sh '''
      set -euo pipefail
      if ! command -v rg &> /dev/null; then
        apt-get update && apt-get install -y ripgrep
      fi
      npm ci
      npm run docs:verify
    '''
  }
}
```

## General CI Pattern

Your CI should run:

```bash
set -euo pipefail

# Ensure ripgrep is available (platform-native preferred)
if ! command -v rg &> /dev/null; then
  apt-get update && apt-get install -y ripgrep
fi

# Install dependencies and verify
npm ci
npm run docs:verify
```

This will:
- ✅ Pass if ripgrep is available AND deployment docs are compliant
- ❌ Fail the build/PR if ripgrep is missing (contract can't be verified)
- ❌ Fail the build/PR if dangerous phrasing is reintroduced
- ❌ Fail the build/PR on any shell error (set -euo pipefail ensures strict error handling)

## Pre-Push Setup (Local Development)

Prevent pushing broken docs locally. Two options:

**Option A: Self-installable (recommended)**

```bash
bash scripts/install-hooks.sh
```

**Option B: Manual**

```bash
cp scripts/pre-push.sh .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

Now `git push` will verify documentation before pushing.

## What the check verifies

1. **Check A:** No fictional `--staging` vs `--prod` phrasing in code/config
2. **Check B:** All references to the nonexistent `vercel deploy --staging` are labeled as historical
3. **Tooling:** Ripgrep (rg) is available for verification

## Reference

- Contract definition: [docs/VERIFICATION_CONTRACT.md](VERIFICATION_CONTRACT.md)
- Implementation: [scripts/verification-contract.sh](../scripts/verification-contract.sh)
- Pre-push hook: [scripts/pre-push.sh](../scripts/pre-push.sh)
- NPM alias: `npm run docs:verify`
