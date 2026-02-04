# DevContainer Configuration

This directory contains the configuration for GitHub Codespaces and VS Code Dev Containers.

## What This Does

When you open this repository in GitHub Codespaces or VS Code with the Dev Containers extension, the `devcontainer.json` file automatically:

1. **Sets up the development environment** with Node.js 20
2. **Installs extensions automatically:**
   - GitHub Copilot (AI assistant)
   - GitHub Copilot Chat (conversational AI)
   - ESLint (code linting)
   - Prettier (code formatting)
   - Tailwind CSS IntelliSense

3. **Configures VS Code settings** for optimal development
4. **Forwards ports** 3000 (Next.js app) and 3001 (worker service)
5. **Runs npm install** automatically

## Documentation

For complete setup instructions, see:
- [docs/CODESPACES_SETUP.md](../docs/CODESPACES_SETUP.md) - Full Codespaces and Copilot guide
- [docs/QUICK_START.md](../docs/QUICK_START.md) - General project setup

## Customizing

To modify the configuration:
1. Edit `devcontainer.json`
2. Rebuild the container: 
   - Command Palette > "Dev Containers: Rebuild Container" or
   - Create a new Codespace

## Learn More

- [Dev Containers Documentation](https://containers.dev/)
- [GitHub Codespaces Documentation](https://docs.github.com/codespaces)
