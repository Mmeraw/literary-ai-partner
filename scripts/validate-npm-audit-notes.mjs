#!/usr/bin/env node
import fs from 'node:fs';

const auditJson = fs.readFileSync(0, 'utf8');
if (!auditJson.trim()) {
  console.error('npm audit returned no JSON; cannot validate allowlist.');
  process.exit(1);
}

let audit;
try {
  audit = JSON.parse(auditJson);
} catch (error) {
  console.error('Failed to parse npm audit JSON:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const notesPath = 'docs/NPM_AUDIT_NOTES.md';
if (!fs.existsSync(notesPath)) {
  console.error(`Missing ${notesPath}; high/critical advisories require documented acceptance.`);
  process.exit(1);
}

const notes = fs.readFileSync(notesPath, 'utf8');
const documented = new Set(
  [...notes.matchAll(/^###\s+(.+?)\s*$/gm)]
    .map((match) => match[1].trim())
    .filter((name) => name && !name.includes('('))
);

const vulnerabilities = audit.vulnerabilities ?? {};
const highOrCritical = Object.entries(vulnerabilities)
  .filter(([, value]) => value && ['high', 'critical'].includes(String(value.severity)))
  .map(([name]) => name);

const undocumented = highOrCritical.filter((name) => !documented.has(name));

if (undocumented.length > 0) {
  console.error('Unexpected high/critical vulns not documented in docs/NPM_AUDIT_NOTES.md:', undocumented);
  console.error('Document each accepted advisory under a markdown heading like: ### package-name');
  process.exit(1);
}

if (highOrCritical.length === 0) {
  console.log('npm audit high/critical clean ✅');
} else {
  console.log('Only documented high/critical advisories remain ✅', highOrCritical);
}
