export {};

const fs = require('fs');
const path = require('path');

describe('evaluation timeout ownership', () => {
  const repoRoot = path.resolve(__dirname, '../../..');

  it('routes processor and canon-governance timeout races through the managed owner', () => {
    for (const relativePath of [
      'lib/evaluation/processor.ts',
      'lib/evaluation/canonGovernanceRunner.ts',
    ]) {
      const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

      expect(source).toContain('withManagedTimeout');
      expect(source).not.toMatch(/Promise\.race\s*\(/);
    }
  });

  it('keeps an explicit clear path for every processor renewal interval', () => {
    const source = fs.readFileSync(
      path.join(repoRoot, 'lib/evaluation/processor.ts'),
      'utf8',
    );
    const intervalOwners = Array.from(
      source.matchAll(/const\s+(\w+)\s*=\s*setInterval\s*\(/g),
      (match: RegExpMatchArray) => match[1],
    );

    expect(intervalOwners.length).toBeGreaterThan(0);
    for (const owner of intervalOwners) {
      expect(source).toContain(`clearInterval(${owner})`);
    }
  });
});
