import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const criticalTests = [
  '__tests__/lib/evaluation/processor.short-text.test.ts',
];

const hasJestBlock = (content) => /\b(test|it)\s*\(/.test(content);

let hasError = false;

for (const relPath of criticalTests) {
  const absPath = path.join(root, relPath);

  if (!fs.existsSync(absPath)) {
    console.error(`[guard-critical-tests] Missing critical test file: ${relPath}`);
    hasError = true;
    continue;
  }

  const content = fs.readFileSync(absPath, 'utf8');
  if (!hasJestBlock(content)) {
    console.error(
      `[guard-critical-tests] Critical test has no Jest test()/it() blocks: ${relPath}`,
    );
    hasError = true;
  }
}

if (hasError) {
  process.exit(1);
}

console.log('[guard-critical-tests] OK');
