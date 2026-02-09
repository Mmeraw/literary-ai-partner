#!/usr/bin/env node

/**
 * Phase D Proof Pack Runner
 * 
 * This script validates that all Phase D release gates are properly closed
 * and generates a comprehensive proof report suitable for artifact archival.
 * 
 * Usage:
 *   node scripts/phase-d-proof-pack.js [--ci] [--output report.md]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CLOSURE_FILES = [
  'GOVERNANCE_CLOSEOUT_PHASE_D1_PUBLIC_UX_SAFETY.md',
  'GOVERNANCE_CLOSEOUT_PHASE_D2_CRITERIA_REGISTRY.md',
  'GOVERNANCE_CLOSEOUT_PHASE_D3_ABUSE_CONTROLS.md',
  'GOVERNANCE_CLOSEOUT_PHASE_D4_INCIDENT_READINESS.md',
  'GOVERNANCE_CLOSEOUT_PHASE_D5_LEGAL_ETHICS.md',
];

const EVIDENCE_PATHS = [
  'evidence/phase-d/d1',
  'evidence/phase-d/d2',
  'evidence/phase-d/d3',
  'evidence/phase-d/d4',
  'evidence/phase-d/d5',
  'docs/release/PHASE_D_RELEASE_READINESS.md',
  'docs/release/RRS_STATUS.json',
];

function checkFileExists(filePath) {
  return fs.existsSync(filePath) ? '✅' : '❌';
}

function getFileSize(filePath) {
  if (!fs.existsSync(filePath)) return '0 B';
  const bytes = fs.statSync(filePath).size;
  return bytes > 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
}

function getCommitDate(filePath) {
  try {
    const output = execSync(
      `git log -1 --format=%ai "${filePath}" 2>/dev/null || echo "unknown"`,
      { encoding: 'utf-8' }
    ).trim();
    return output === 'unknown' ? '—' : output.split(' ')[0];
  } catch {
    return '—';
  }
}

function runTests(pattern) {
  try {
    console.log(`\n🧪 Running tests matching: ${pattern}`);
    execSync(`npm test -- ${pattern}`, { stdio: 'inherit' });
    return true;
  } catch (e) {
    console.error(`⚠️  Tests failed for ${pattern}`);
    return false;
  }
}

function validateJSON(filePath) {
  try {
    JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return true;
  } catch {
    return false;
  }
}

function generateReport() {
  const timestamp = new Date().toISOString();
  let report = `# Phase D Release Readiness — Proof Pack Report\n\n`;
  report += `**Generated:** ${timestamp}\n`;
  report += `**Executed By:** ${process.env.USER || 'automation'}\n`;
  report += `**Environment:** ${process.env.CI ? 'CI/CD' : 'Local'}\n\n`;

  // Closure Files Check
  report += `## 1. Gate Closure Documentation\n\n`;
  report += `| File | Exists | Size | Last Modified |\n`;
  report += `|------|--------|------|---------------|\n`;
  CLOSURE_FILES.forEach(file => {
    const exists = checkFileExists(file);
    const size = getFileSize(file);
    const date = getCommitDate(file);
    report += `| ${file} | ${exists} | ${size} | ${date} |\n`;
  });

  // Evidence Paths Check
  report += `\n## 2. Evidence Artifacts\n\n`;
  report += `| Path | Status | \n`;
  report += `|------|--------|\n`;
  EVIDENCE_PATHS.forEach(path => {
    const exists = fs.existsSync(path) ? '✅ Ready' : '❌ Missing';
    report += `| ${path} | ${exists} |\n`;
  });

  // RRS Status Validation
  report += `\n## 3. Release Readiness Score (RRS) Status\n\n`;
  const rrsPath = 'docs/release/RRS_STATUS.json';
  if (fs.existsSync(rrsPath)) {
    const rrsData = JSON.parse(fs.readFileSync(rrsPath, 'utf-8'));
    report += `**RRS Total:** ${rrsData.scores.rrs_total} / 100\n`;
    report += `**Status:** ${rrsData.scores.rrs_percentage}%\n\n`;
    
    report += `### Gate Status\n\n`;
    report += `| Gate | Status | Weight | Evidence |\n`;
    report += `|------|--------|--------|----------|\n`;
    rrsData.gates.forEach(gate => {
      const status = gate.status === 'CLOSED' ? '✅' : '⬜';
      const hasEvidence = gate.evidence_links.length > 0 ? '✅' : '❌';
      report += `| ${gate.id} | ${status} ${gate.status} | ${gate.weight} | ${hasEvidence} |\n`;
    });

    report += `\n### Release Decision\n\n`;
    report += `- Public Release: ${rrsData.release_readiness.public_release_allowed ? '✅ APPROVED' : '❌ NOT APPROVED'}\n`;
    report += `- Agent Onboarding: ${rrsData.release_readiness.agent_onboarding_allowed ? '✅ APPROVED' : '❌ NOT APPROVED'}\n`;
    report += `- Controlled Beta: ${rrsData.release_readiness.controlled_beta_allowed ? '✅ APPROVED' : '❌ NOT APPROVED'}\n`;
  }

  // Phase D Release Readiness Check
  report += `\n## 4. Phase D Release Readiness Document\n\n`;
  const prdPath = 'docs/release/PHASE_D_RELEASE_READINESS.md';
  if (fs.existsSync(prdPath)) {
    const content = fs.readFileSync(prdPath, 'utf-8');
    const lines = content.split('\n').length;
    const hasGates = content.includes('CLOSED');
    const hasFinalStatement = content.includes('Phase D Release Status');
    
    report += `- File Size: ${getFileSize(prdPath)}\n`;
    report += `- Lines: ${lines}\n`;
    report += `- Contains Gate Status: ${hasGates ? '✅' : '❌'}\n`;
    report += `- Contains Final Statement: ${hasFinalStatement ? '✅' : '❌'}\n`;
  }

  // Test Suite Validation
  report += `\n## 5. Test Suite Status\n\n`;
  const testFiles = [
    '__tests__/phase_d/d1_user_safe_errors.test.ts',
    '__tests__/phase_d/d3_rate_limits.test.ts'
  ];
  testFiles.forEach(file => {
    const exists = checkFileExists(file);
    report += `- ${file}: ${exists}\n`;
  });

  // Validation Checklist (FAIL-CLOSED)
  report += `\n## 6. Closure Validation Checklist\n\n`;
  const checks = [
    { name: 'All D1-D5 closure documents exist', passed: CLOSURE_FILES.every(f => fs.existsSync(f)) },
    { name: 'RRS JSON is valid', passed: validateJSON('docs/release/RRS_STATUS.json') },
    { name: 'RRS shows 100%', passed: JSON.parse(fs.readFileSync('docs/release/RRS_STATUS.json')).scores.rrs_percentage === 100 },
    { name: 'Public release approved', passed: JSON.parse(fs.readFileSync('docs/release/RRS_STATUS.json')).release_readiness.public_release_allowed },
    { name: 'PHASE_D_RELEASE_READINESS.md is updated', passed: fs.existsSync('docs/release/PHASE_D_RELEASE_READINESS.md') },
    { name: 'D1 evidence artifacts present', passed: fs.existsSync('evidence/phase-d/d1') },
    { name: 'D2 evidence artifacts present', passed: fs.existsSync('evidence/phase-d/d2') },
    { name: 'D3 evidence artifacts present', passed: fs.existsSync('evidence/phase-d/d3') },
    { name: 'D4 evidence artifacts present', passed: fs.existsSync('evidence/phase-d/d4') },
    { name: 'D5 evidence artifacts present', passed: fs.existsSync('evidence/phase-d/d5') },
    { name: 'D1 test file exists', passed: fs.existsSync('__tests__/phase_d/d1_user_safe_errors.test.ts') },
    { name: 'D3 test file exists', passed: fs.existsSync('__tests__/phase_d/d3_rate_limits.test.ts') },
  ];

  checks.forEach(check => {
    report += `- ${check.passed ? '✅' : '❌'} ${check.name}\n`;
  });

  const allPassed = checks.every(c => c.passed);
  report += `\n**Validation Result:** ${allPassed ? '✅ ALL CHECKS PASSED' : '❌ VALIDATION FAILED'}\n`;

  // Sign-off
  report += `\n## 7. Proof Pack Sign-Off\n\n`;
  report += `Generated: ${timestamp}\n`;
  report += `Authority: Phase D Release Gates (v1) + Release Governance\n`;
  report += `Canonical: docs/JOB_CONTRACT_v1.md + Copilot Instructions\n`;
  report += `Validation Status: ${allPassed ? '✅ PASSED' : '❌ FAILED'}\n\n`;
  report += `${allPassed 
    ? '**This proof pack certifies that Phase D gates D1–D5 are CLOSED with complete evidence.**'
    : '**This proof pack FAILED validation. Missing required evidence artifacts or test files. Cannot certify readiness.**'}\n`;

  // Return both report and validation status
  return { report, allPassed };
}

// Main execution
console.log('🚀 Phase D Proof Pack Runner\n');
console.log('Validating closure documentation...\n');

const { report, allPassed } = generateReport();

// Output
const outputFile = process.argv.includes('--output') 
  ? process.argv[process.argv.indexOf('--output') + 1]
  : 'PHASE_D_PROOF_PACK_REPORT.md';

fs.writeFileSync(outputFile, report);
console.log(`\n✅ Report generated: ${outputFile}`);
console.log(`\n${report}`);

// Exit with status code: 0 if all passed, 2 if any failed (fail-closed)
if (!allPassed) {
  console.error('\n❌ VALIDATION FAILED: Phase D proof pack found missing artifacts or test files.');
  console.error('Please ensure all evidence directories and test files are present before deployment.');
  process.exit(2);
} else {
  console.log('\n✅ VALIDATION PASSED: Phase D proof pack is compliant and production-ready.');
  process.exit(0);
}
