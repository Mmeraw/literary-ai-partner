#!/bin/bash
# Git Hooks Installer (Security-Focused)
# 
# Purpose: Install pre-commit hooks for all contributors
# Usage: ./scripts/install-hooks.sh

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "=== Git Hooks Installer (Security) ==="
echo ""

# Check if we're in a git repository
if [ ! -d ".git" ]; then
  echo -e "${RED}❌ Not in a git repository root${NC}"
  echo "   Run this from the project root directory"
  exit 1
fi

# Check if hooks directory exists
if [ ! -d ".git/hooks" ]; then
  echo -e "${YELLOW}⚠️  Creating .git/hooks directory${NC}"
  mkdir -p .git/hooks
fi

echo "Installing git hooks..."
echo ""

# Install pre-commit hook (secret scanner + canon guard)
HOOK_FILE=".git/hooks/pre-commit"
echo "📦 Installing pre-commit hook (secret scanner + canon guard)..."

# Backup existing hook if present
if [ -f "$HOOK_FILE" ]; then
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  BACKUP_FILE="${HOOK_FILE}.backup.${TIMESTAMP}"
  echo "   Existing hook found - backing up to: $BACKUP_FILE"
  cp "$HOOK_FILE" "$BACKUP_FILE"
fi

cat > "$HOOK_FILE" << 'EOF'
#!/bin/bash
# Git Pre-Commit Hook
# 
# Runs before every commit to ensure code quality and security

set -e

echo "Running pre-commit checks..."

# 1. Check for secrets in staged changes
echo ""
echo "🔒 Checking for hardcoded secrets..."
if bash scripts/check-secrets.sh --staged; then
  echo "✅ Secret scan passed"
else
  echo "❌ Secret scan failed - commit blocked"
  exit 1
fi

# 2. Run existing canon guard checks (if they exist)
if [ -f "scripts/canon-guard.sh" ]; then
  echo ""
  echo "🔒 Canon Guard: JOB_CONTRACT_v1 checks..."
  if bash scripts/canon-guard.sh; then
    echo "✅ Canon Guard passed"
  else
    echo "❌ Canon Guard failed - commit blocked"
    exit 1
  fi
fi

echo ""
echo "Pre-commit checks passed."
exit 0
EOF

chmod +x "$HOOK_FILE"

if [ -n "${BACKUP_FILE:-}" ]; then
  echo -e "${GREEN}✅ Pre-commit hook updated (backup created)${NC}"
else
  echo -e "${GREEN}✅ Pre-commit hook installed${NC}"
fi

echo ""

# Also preserve existing deployment pre-push hook if it exists
if [ -f "scripts/install-hooks.sh.old" ]; then
  echo "📋 Note: Existing deployment pre-push hook installer backed up"
  echo "   To install deployment hooks, run: bash scripts/install-hooks.sh.old"
  echo ""
fi

echo "=== Installation Complete ==="
echo ""
echo "What happens now:"
echo "- Every 'git commit' will run secret scanner automatically"
echo "- Commits containing secrets will be blocked"
echo "- Canon guard checks will run (if configured)"
echo ""
echo "To test:"
echo "  echo 'test' > test.txt"
echo "  git add test.txt"
echo "  git commit -m 'test'  # Should show 'Running pre-commit checks...'"
echo ""
echo "To reinstall (if hooks are modified):"
echo "  ./scripts/install-hooks.sh"
echo ""
echo -e "${GREEN}🎯 Git hooks are now active!${NC}"
