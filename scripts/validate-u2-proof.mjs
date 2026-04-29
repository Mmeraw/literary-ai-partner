#!/usr/bin/env node
import fs from 'node:fs';

const raw = fs.readFileSync(0, 'utf8');
if (!raw.trim()) {
  console.error('U2 proof input is empty; pipe JSON proof into stdin.');
  process.exit(1);
}

let proof;
try {
  proof = JSON.parse(raw);
} catch (error) {
  console.error('Failed to parse U2 proof JSON:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const errors = [];

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const isNonEmptyArray = (value) => Array.isArray(value) && value.length > 0;

const getPath = (obj, path) => path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
const requireValue = (path, predicate, message) => {
  const value = getPath(proof, path);
  if (!predicate(value)) {
    errors.push(`${path}: ${message}`);
  }
};

requireValue('job', isObject, 'missing object');
requireValue('job.status', (value) => value === 'complete', 'must equal "complete" for closure proof');
requireValue('u2Proof', isObject, 'missing object');
requireValue('u2Proof.confidenceLabel', isNonEmptyString, 'must be a non-empty string');
requireValue('u2Proof.confidenceReasons', isNonEmptyArray, 'must be a non-empty array');
requireValue('u2Proof.propagation', (value) => value !== null && value !== undefined, 'must be present (not null/undefined)');
requireValue('u2Proof.anchors', isNonEmptyArray, 'must be a non-empty array');
requireValue('u2Proof.reasonCodes', isNonEmptyArray, 'must be a non-empty array');

requireValue('verificationChecklist', isObject, 'missing object');

const checklist = proof?.verificationChecklist;
if (isObject(checklist)) {
  const requiredChecklistKeys = [
    'bottomWeaknessInSummary',
    'confidenceBannerMatchesLabel',
    'noFalseHighConfidenceAuthority',
  ];

  for (const key of requiredChecklistKeys) {
    const value = checklist[key];
    if (value !== 'PASS') {
      errors.push(`verificationChecklist.${key}: expected "PASS", got ${JSON.stringify(value)}`);
    }
  }
}

if (errors.length > 0) {
  console.error('U2 proof validation failed ❌');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('U2 proof validation passed ✅');
