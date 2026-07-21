import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const criticalTests = [
  '__tests__/lib/evaluation/processor.short-text.test.ts',
  '__tests__/evaluation/storyLedgerExtensions.test.ts',
  '__tests__/evaluation/e2eNamingContract.test.ts',
  '__tests__/lib/evaluation/architecture-invariants.test.ts',
  '__tests__/lib/evaluation/persistEvaluationResultV2.boundary-gate.test.ts',
  '__tests__/lib/evaluation/managedTimeout.test.ts',
  '__tests__/lib/evaluation/processor-timeout-ownership.test.ts',
  '__tests__/lib/evaluation/test-fixtures/currentProcessorEvaluationResult.test.ts',
  '__tests__/lib/evaluation/test-fixtures/currentProcessorSynthesisOutput.test.ts',
  '__tests__/smoke/short-form-kickback.submit-smoke.test.ts',
  'tests/evaluation/currentRecommendationDispositionWriteTypes.test.ts',
  'tests/evaluation/dialogueSoftFail.test.ts',
  'tests/evaluation/pipeline/test-fixtures/currentPass3Response.test.ts',
  'tests/scripts/analyze-pg06b-editorial-calibration.test.ts',
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
