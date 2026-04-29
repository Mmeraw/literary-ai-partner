#!/usr/bin/env node
import fs from 'node:fs';

const input = fs.readFileSync(0, 'utf8');
if (!input.trim()) {
  console.error('U2 proof validator expected JSON on stdin.');
  process.exit(1);
}

let proof;
try {
  proof = JSON.parse(input);
} catch (error) {
  console.error('Invalid U2 proof JSON:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const failures = [];
const requireValue = (path, value) => {
  if (value === null || value === undefined || value === '') failures.push(`${path} is missing`);
};

requireValue('jobId', proof.jobId);
requireValue('job.status', proof.job?.status);
requireValue('artifact', proof.artifact);
requireValue('u2Proof.confidenceLabel', proof.u2Proof?.confidenceLabel);
requireValue('u2Proof.confidenceReasons', proof.u2Proof?.confidenceReasons);
requireValue('u2Proof.propagation', proof.u2Proof?.propagation);
requireValue('u2Proof.anchors', proof.u2Proof?.anchors);
requireValue('u2Proof.reasonCodes', proof.u2Proof?.reasonCodes);

if (proof.job?.status !== 'complete') {
  failures.push(`job.status must be complete, got ${JSON.stringify(proof.job?.status)}`);
}

const checklist = proof.verificationChecklist ?? {};
for (const key of [
  'bottomWeaknessInSummary',
  'confidenceBannerMatchesLabel',
  'noFalseHighConfidenceAuthority',
  'propagationPersistedInDB',
]) {
  const value = checklist[key];
  if (typeof value !== 'string' || value.startsWith('PENDING') || value.startsWith('FAIL')) {
    failures.push(`verificationChecklist.${key} must be resolved manually, got ${JSON.stringify(value)}`);
  }
}

if (failures.length > 0) {
  console.error('U2 proof validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('U2 proof validation passed ✅');
