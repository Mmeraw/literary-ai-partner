# GitHub Codespaces Setup Guide

## 🚀 Getting Started with GitHub Codespaces

This guide will help you set up and use GitHub Codespaces for the RevisionGrade project, including enabling GitHub Copilot AI assistant.

## 📋 Prerequisites

1. **GitHub Account** with access to this repository
2. **GitHub Copilot Subscription** (Individual, Business, or Enterprise)
   - Check your subscription status: [github.com/settings/copilot](https://github.com/settings/copilot)
   - If you don't have Copilot, you can start a free trial from the settings page

## 🤖 Enabling GitHub Copilot in Codespaces

### Method 1: Automatic Setup (Recommended)

This repository includes a `.devcontainer` configuration that automatically enables Copilot extensions when you create a new Codespace.

1. **Create a Codespace:**
   - Go to the repository on GitHub
   - Click the green **Code** button
   - Select the **Codespaces** tab
   - Click **Create codespace on main** (or your branch)

2. **Wait for Setup:**
   - The Codespace will automatically install and configure GitHub Copilot
   - You'll see the Copilot icon in the status bar when ready

3. **Verify Copilot is Active:**
   - Look for the Copilot icon (✨) in the bottom-right status bar
   - The icon should show as enabled (not crossed out)

### Method 2: Manual Setup

If you need to manually enable Copilot in an existing Codespace:

1. **Open Extensions View:**
   - Press `Ctrl+Shift+X` (Windows/Linux) or `Cmd+Shift+X` (Mac)
   - Or click the Extensions icon in the left sidebar

2. **Install GitHub Copilot:**
   - Search for "GitHub Copilot"
   - Install the **GitHub Copilot** extension
   - Optionally install **GitHub Copilot Chat** for conversational AI assistance

3. **Sign In:**
   - After installation, you may be prompted to sign in to GitHub
   - Follow the prompts to authorize Copilot

4. **Verify Installation:**
   - Check the status bar for the Copilot icon (✨)
   - Try typing code to see inline suggestions appear

## ⚙️ GitHub Copilot Settings

### Configure Copilot Behavior

1. **Open Settings:**
   - Press `Ctrl+,` (Windows/Linux) or `Cmd+,` (Mac)
   - Or go to File > Preferences > Settings

2. **Search for "Copilot"**

3. **Recommended Settings:**
   ```json
   {
     "github.copilot.enable": {
       "*": true,
       "yaml": true,
       "plaintext": false,
       "markdown": true
     },
     "github.copilot.editor.enableAutoCompletions": true
   }
   ```

### Enable/Disable Copilot Temporarily

- **Status Bar Icon:** Click the Copilot icon (✨) in the bottom-right
- **Keyboard Shortcut:** Use `Ctrl+Alt+]` to toggle suggestions

## 💡 Using GitHub Copilot

### Inline Suggestions

1. **Start typing code** - Copilot will suggest completions in gray text
2. **Accept suggestion:** Press `Tab`
3. **See alternative suggestions:** Press `Alt+]` (next) or `Alt+[` (previous)
4. **Reject suggestion:** Press `Esc` or keep typing

### Copilot Chat

If you installed GitHub Copilot Chat:

1. **Open Chat:**
   - Press `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Shift+I` (Mac)
   - Or click the chat icon in the left sidebar

2. **Ask Questions:**
   - "How do I implement authentication?"
   - "Explain this code"
   - "Write tests for this function"

3. **Use Chat Commands:**
   - `/explain` - Explain selected code
   - `/fix` - Suggest fixes for problems
   - `/tests` - Generate tests
   - `/doc` - Generate documentation

## 🔧 Project-Specific Configuration

### Environment Setup

After creating your Codespace, set up the project environment:

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.test.example .env.local

# 3. Configure Supabase (CRITICAL)
# Edit .env.local with production credentials:
# NEXT_PUBLIC_SUPABASE_URL=https://xtumxjnzdswuumndcbwc.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=[from Supabase Dashboard]
# NEXT_PUBLIC_SUPABASE_ANON_KEY=[from Supabase Dashboard]

# 4. Verify configuration
bash scripts/verify-supabase-project.sh

# 5. Start development server
npm run dev
```

### Copilot Context

To get better suggestions from Copilot, ensure it understands the project:

1. **Open relevant files** - Copilot uses open tabs as context
2. **Read contracts first:**
   - `docs/JOB_CONTRACT_v1.md` - Canonical job state machine
   - `.github/copilot-instructions.md` - Project governance rules
3. **Use descriptive comments** - Help Copilot understand your intent

## 🎯 Copilot Best Practices for This Project

### Follow Project Governance

This project has strict governance rules. When using Copilot:

1. **Job Status Values:**
   - Only use: `"queued"`, `"running"`, `"complete"`, `"failed"`
   - Never use: `"completed"`, `"pending"`, or other variants

2. **Review Suggestions:**
   - Always verify Copilot suggestions against `docs/JOB_CONTRACT_v1.md`
   - Don't blindly accept code that violates contracts

3. **Type Safety:**
   - Use TypeScript types from the project
   - Run `npm run evidence:phase2c` to verify types

### Example Workflow

```typescript
// 1. Add a comment describing what you need
// Create a function to update job status from queued to running

// 2. Copilot will suggest implementation
// 3. Review suggestion against JOB_CONTRACT_v1.md
// 4. Accept or modify as needed
```

## 🛠️ Troubleshooting

### Copilot Not Working

**Issue:** Copilot icon shows as disabled or crossed out

**Solutions:**
1. Check subscription: [github.com/settings/copilot](https://github.com/settings/copilot)
2. Sign out and sign back in: Command Palette > "GitHub Copilot: Sign Out"
3. Reload window: `Ctrl+Shift+P` > "Developer: Reload Window"

### No Suggestions Appearing

**Issue:** Copilot is enabled but no suggestions show

**Solutions:**
1. Check if Copilot is active for the file type (Settings > Copilot)
2. Try typing more code - Copilot needs context
3. Check network connection - Codespaces may have connectivity issues

### Slow Suggestions

**Issue:** Suggestions take a long time to appear

**Solutions:**
1. Check Codespace resources (CPU/Memory)
2. Reduce number of open files
3. Restart Codespace if necessary

### Wrong or Irrelevant Suggestions

**Solutions:**
1. Provide more context with comments
2. Open relevant project files
3. Use more specific variable/function names
4. Guide Copilot with partial code instead of starting from scratch

## 📚 Additional Resources

- **GitHub Copilot Documentation:** [docs.github.com/copilot](https://docs.github.com/en/copilot)
- **Codespaces Documentation:** [docs.github.com/codespaces](https://docs.github.com/en/codespaces)
- **VS Code Keyboard Shortcuts:** [code.visualstudio.com/shortcuts](https://code.visualstudio.com/shortcuts)
- **Project Quick Start:** [docs/QUICK_START.md](./QUICK_START.md)

## 🔒 Security Notes

- **Never commit secrets** - Copilot suggestions should never include API keys
- **Review generated code** - Especially security-sensitive operations
- **Follow project patterns** - Copilot learns from the codebase

## 💡 Tips for Maximum Productivity

1. **Use descriptive names** - Better names = better suggestions
2. **Write comments first** - Explain what you want to build
3. **Keep files focused** - Smaller files help Copilot understand context
4. **Learn keyboard shortcuts** - Accept/reject suggestions quickly
5. **Experiment with Chat** - Ask questions about the codebase

---

**Need Help?**
- Project-specific questions: See [docs/QUICK_START.md](./QUICK_START.md)
- Copilot issues: [GitHub Copilot Support](https://support.github.com/)
- Codespaces issues: [Codespaces Support](https://support.github.com/)

**Last Updated:** February 2026
