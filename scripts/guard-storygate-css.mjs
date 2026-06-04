#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();

const cssFile = join(repoRoot, 'app/storygate-studio/storygate-studio.module.css');
const industryDir = join(repoRoot, 'app/storygate-studio/industry');

const failures = [];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

// Guard 1: prevent the exact CSS Modules purity regression that broke prod
const css = readFileSync(cssFile, 'utf8');
if (/^\s*section\s*\{/m.test(css)) {
  failures.push(`${cssFile}: top-level "section {" is forbidden in CSS modules; scope with a local class (e.g. ".container section {")`);
}
if (/\{[^{}]*\n\s*section\s*\{/m.test(css) || /@media[\s\S]*?\n\s*section\s*\{/m.test(css)) {
  failures.push(`${cssFile}: nested or media-query "section {" is forbidden in CSS modules; scope with a local class`);
}

// Guard 2: ensure Storygate industry pages import the stylesheet from the correct relative path
const industryFiles = walk(industryDir).filter((p) => p.endsWith('.tsx'));
for (const filePath of industryFiles) {
  const src = readFileSync(filePath, 'utf8');
  if (src.includes('storygate-studio.module.css')) {
    const hasCorrect = /from\s+['"]\.\.\/\.\.\/storygate-studio\.module\.css['"]/.test(src);
    const hasKnownBad = /from\s+['"]\.\.\/storygate-studio\.module\.css['"]/.test(src);
    if (!hasCorrect || hasKnownBad) {
      failures.push(`${filePath}: must import storygate stylesheet via ../../storygate-studio.module.css`);
    }
  }
}

if (failures.length > 0) {
  console.error('Storygate CSS guard failed:\n');
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}

console.log(`Storygate CSS guard passed (${industryFiles.length} industry TSX files checked).`);
