#!/usr/bin/env node
/**
 * GPG Disabled Enforcement
 *
 * Validates that GPG signing is explicitly disabled in repository configuration.
 * This is a governance requirement: commits must not rely on developer GPG keys.
 *
 * Policy: AI_GOVERNANCE.md section 4 (Cryptographic Signing Policy)
 *
 * Fails if:
 * - commit.gpgsign is set to "true"
 * - tag.gpgsign is set to "true"
 * - user.signingkey is set to a non-empty value
 * - ANY workflow passes --gpg-sign or -S to git commands
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let failed = false;

console.log('🔒 GPG Disabled: Checking git config...');

// Helper function to safely get git config value (returns empty string if key doesn't exist)
function getGitConfigValue(key) {
  try {
    const result = execSync(`git config --local ${key}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    return result.trim();
  } catch (err) {
    // Git returns exit code 1 if config key doesn't exist; that's OK (treated as unset)
    // In CI, freshly cloned repos don't have local config; this is expected
    return ''; // Key doesn't exist; treat as unset
  }
}

// Check git config
// Note: In CI, freshly cloned repos typically don't have local config set
// This is expected and OK - we just ensure GPG signing isn't explicitly enabled
const commitSign = getGitConfigValue('commit.gpgsign');
if (commitSign === 'true') {
  console.error('❌ FAIL: commit.gpgsign is set to true. Must be false or unset.');
  failed = true;
} else {
  console.log('✅ commit.gpgsign:', commitSign || '(not set)');
}

const tagSign = getGitConfigValue('tag.gpgsign');
if (tagSign === 'true') {
  console.error('❌ FAIL: tag.gpgsign is set to true. Must be false or unset.');
  failed = true;
} else {
  console.log('✅ tag.gpgsign:', tagSign || '(not set)');
}

const signingKey = getGitConfigValue('user.signingkey');
if (signingKey && signingKey.length > 0) {
  console.error('❌ FAIL: user.signingkey is set. Must be empty.');
  failed = true;
} else {
  console.log('✅ user.signingkey:', '(empty)');
}

// Check workflows for --gpg-sign or -S flags
console.log('\n🔒 GPG Disabled: Scanning CI workflows...');
const workflowDir = path.join(__dirname, '..', '.github', 'workflows');
if (fs.existsSync(workflowDir)) {
  const files = fs
    .readdirSync(workflowDir)
    .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));

  files.forEach(file => {
    const content = fs.readFileSync(path.join(workflowDir, file), 'utf8');
    if (content.includes('--gpg-sign') || (content.includes(' -S ') && content.includes('git '))) {
      console.error(`❌ FAIL: ${file} contains GPG signing flags (--gpg-sign or -S).`);
      failed = true;
    }
  });

  if (!failed) {
    console.log(`✅ Scanned ${files.length} workflow(s): no GPG signing flags found.`);
  }
}

if (failed) {
  console.error('\n❌ GPG Disabled enforcement FAILED');
  process.exit(1);
}

console.log('\n✅ GPG Disabled enforcement PASSED');
process.exit(0);
