# Deployment Documentation Verification: Setup Guide

This guide covers setting up the verification contract locally and in CI.

## Quick Start

### Local Pre-Push Hook (Recommended)

**Option A: Self-installable (recommended)**

```bash
bash scripts/install-hooks.sh
```

**Option B: Manual**

```bash
cp scripts/pre-push.sh .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

Now `git push` will automatically verify deployment documentation.

### Manual Verification

```bash
npm run docs:verify
```

### Ripgrep Installation

The contract requires ripgrep (rg). Install with your platform's package manager (preferred):

**Ubuntu/Debian:**
```bash
sudo apt-get install ripgrep
```

**macOS:**
```bash
brew install ripgrep
```

**Windows:**
```bash
# Option 1: Chocolatey
choco install ripgrep

# Option 2: Scoop
scoop install ripgrep
```

**Fallback (any platform, requires Rust):**
```bash
cargo install ripgrep
```

Verify installation:
```bash
rg --version
```

## CI/CD Integration

See [CI_INTEGRATION.md](CI_INTEGRATION.md) for platform-specific setup.

**Universal pattern:**
```bash
# Ensure ripgrep is available
command -v rg &> /dev/null || apt-get install -y ripgrep

# Run verification
npm run docs:verify || exit 1
```

## What Gets Verified

| Check | Rule | Scope |
|-------|------|-------|
| **A** | No fictional staging/prod flag phrasing | Code/config (excludes .md/.sh) |
| **B** | All nonexistent commands labeled | Code/config (excludes .md/.sh) |
| **Tooling** | Ripgrep available | All |

## Contract Details

- Full specification: [VERIFICATION_CONTRACT.md](VERIFICATION_CONTRACT.md)
- Implementation: [scripts/verification-contract.sh](../scripts/verification-contract.sh)
- Pre-push hook: [scripts/pre-push.sh](../scripts/pre-push.sh)

## Troubleshooting

### "ripgrep not found on PATH"

Install ripgrep using the instructions above, then verify:
```bash
rg --version
```

### Pre-push hook not running

Ensure hook is executable:
```bash
chmod +x .git/hooks/pre-push
```

Or reinstall:
```bash
cp scripts/pre-push.sh .git/hooks/pre-push && chmod +x .git/hooks/pre-push
```

### Contract passes but it shouldn't

Verify the script is running the correct checks:
```bash
bash scripts/verification-contract.sh
```

If it passes but shouldn't, check for whitespace or encoding issues in flagged files.
