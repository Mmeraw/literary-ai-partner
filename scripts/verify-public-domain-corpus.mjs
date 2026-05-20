import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const registryPath = path.join(root, 'corpus/public-domain/registry.json');

function fail(message) {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`✅ ${message}`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function countWords(text) {
  return (text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) || []).length;
}

function countMatches(text, pattern, flags = 'g') {
  const re = new RegExp(pattern, flags);
  return [...text.matchAll(re)].length;
}

function romanToInt(roman) {
  const values = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  let previous = 0;
  for (const ch of roman.toUpperCase().split('').reverse()) {
    const value = values[ch] || 0;
    if (value < previous) total -= value;
    else total += value;
    previous = Math.max(previous, value);
  }
  return total;
}

function assertNoArtifacts(text, work, patterns) {
  for (const pattern of patterns) {
    const re = new RegExp(pattern, 'i');
    if (re.test(text)) {
      fail(`${work.id}: forbidden source artifact matched /${pattern}/`);
    }
  }
}

function verifyWork(work, registry) {
  const absolutePath = path.join(root, work.sourceTextPath);
  if (!fs.existsSync(absolutePath)) {
    fail(`${work.id}: missing clean source text at ${work.sourceTextPath}`);
    return;
  }

  const text = fs.readFileSync(absolutePath, 'utf8');
  const integrity = work.integrity || {};
  const words = countWords(text);
  const wordMin = integrity.wordCount?.min ?? 0;
  const wordMax = integrity.wordCount?.max ?? Number.MAX_SAFE_INTEGER;

  if (words < wordMin || words > wordMax) {
    fail(`${work.id}: word count ${words} outside expected range ${wordMin}-${wordMax}`);
  } else {
    ok(`${work.id}: word count ${words} within expected range`);
  }

  const apostrophes = countMatches(text, "['’]", 'g');
  const minApostrophes = integrity.minApostrophes ?? 0;
  if (apostrophes < minApostrophes) {
    fail(`${work.id}: apostrophe count ${apostrophes} below minimum ${minApostrophes}; source may have been over-normalized`);
  } else {
    ok(`${work.id}: apostrophe count ${apostrophes} passes preservation floor`);
  }

  assertNoArtifacts(text, work, registry.defaultArtifactExclusionPatterns || []);

  if (integrity.chapterHeadingPattern) {
    const chapterRe = new RegExp(integrity.chapterHeadingPattern, 'gm');
    const matches = [...text.matchAll(chapterRe)];
    if (matches.length !== integrity.expectedChapterCount) {
      fail(`${work.id}: chapter count ${matches.length} !== expected ${integrity.expectedChapterCount}`);
    } else {
      ok(`${work.id}: chapter count ${matches.length} matches expected`);
    }

    if (integrity.strictRomanChapterSequence) {
      const bad = [];
      matches.forEach((match, index) => {
        const roman = match[1];
        const value = romanToInt(roman);
        if (value !== index + 1) {
          bad.push(`${roman}->${value} at position ${index + 1}`);
        }
      });
      if (bad.length) {
        fail(`${work.id}: roman chapter sequence mismatch: ${bad.slice(0, 10).join(', ')}`);
      } else if (matches.length) {
        ok(`${work.id}: roman chapter sequence is continuous`);
      }
    }
  }

  if (work.calibrationDocPath && !fs.existsSync(path.join(root, work.calibrationDocPath))) {
    fail(`${work.id}: missing calibration doc at ${work.calibrationDocPath}`);
  }
}

if (!fs.existsSync(registryPath)) {
  fail(`Missing public-domain registry: ${registryPath}`);
  process.exit(1);
}

const registry = readJson(registryPath);
if (registry.policy?.runtimeAuthority !== false) {
  fail('Registry policy must keep public-domain texts out of runtime authority');
}
if (registry.policy?.ordinaryEvaluationPromptInjection !== false) {
  fail('Registry policy must forbid ordinary evaluation prompt injection');
}

for (const work of registry.works || []) {
  verifyWork(work, registry);
}

if (process.exitCode) {
  console.error('\nPublic-domain corpus verification failed. Fix clean texts or registry expectations before using as calibration fixtures.');
  process.exit(process.exitCode);
}

console.log('\nPublic-domain corpus verification passed.');
