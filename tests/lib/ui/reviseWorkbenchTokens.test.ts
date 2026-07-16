import { readFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();

function readCss(file: string) {
  return readFileSync(join(root, file), 'utf-8');
}

describe('Revise Workbench token system', () => {
  it('has a dedicated token file with semantic CSS variables and utility classes', () => {
    const css = readCss('app/revise-workbench-tokens.css');
    expect(css).toContain('--rg-workbench-bg');
    expect(css).toContain('--rg-workbench-text-primary');
    expect(css).toContain('--rg-workbench-text-secondary');
    expect(css).toContain('--rg-workbench-text-muted');
    expect(css).toContain('--rg-workbench-gold');
    expect(css).toContain('.rg-workbench-text-primary');
    expect(css).toContain('.rg-workbench-surface');
  });

  it('does not introduce a generic global Tailwind utility override', () => {
    const globals = readCss('app/globals.css');
    const tokens = readCss('app/revise-workbench-tokens.css');
    const guard = readCss('app/button-contrast-guard.css');
    const globalUtilityPattern = /(?:^|[,{}])\s*\.(?:text|bg|border)-(stone|gray|neutral)-\d+\s*\{/;
    expect(globals).not.toMatch(globalUtilityPattern);
    expect(tokens).not.toMatch(globalUtilityPattern);
    expect(guard).not.toMatch(globalUtilityPattern);
  });

  it('does not use !important in the token stylesheet', () => {
    const css = readCss('app/revise-workbench-tokens.css');
    expect(css).not.toContain('!important');
  });
});
