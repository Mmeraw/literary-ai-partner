import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const roots = ['app/page.tsx','app/pricing','app/resources','app/reliability','app/methodology','app/black-box-problem','app/faq','app/privacy','app/security','app/storygate','app/storygate-studio','app/agent-readiness','app/revise'];
const exts = new Set(['.ts','.tsx','.js','.jsx','.md','.mdx']);
const skipParts = new Set(['api','admin','__tests__','__mocks__']);
const allow = 'public-copy-scope-allow';
const blocked = [
  ['film slash tv', /\bfilm\s*\/\s*tv\b/i],
  ['screenplay', /\bscreenplays?\b/i],
  ['screen project', /\bscreen\s+projects?\b/i],
  ['screen adaptation', /\bscreen\s+adaptations?\b/i],
  ['adaptation package', /\badaptation\s+packages?\b/i],
  ['pitch deck', /\bpitch\s+decks?\b/i],
  ['lookbook', /\blookbooks?\b/i],
  ['source material package', /\bsource\s+material\s+(summary|summaries|package|packages|materials?)\b/i],
  ['series package', /\bseries\s+packages?\b/i],
  ['franchise package', /\bfranchise\s+packages?\b/i],
  ['development exec', /\bdevelopment\s+exec(utive)?s?\b/i],
  ['novel to screenplay', /\bnovel\s*(-|–|—|to)\s*to\s*(-|–|—)?\s*screenplay\b/i],
  ['chapter to scene', /\bchapter\s+to\s+scene\b/i],
  ['Gate 15', /\bgate\s*15\b/i],
  ['Volumes I-VI', /\bvolumes?\s+i\s*(-|–|—|to)\s*vi\b/i],
  ['repo gates', /\brepo\s+gates?\b/i],
  ['canon gates', /\bcanon\s*\/\s*gates?\b/i]
];

function stripBlockComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, m => '\n'.repeat((m.match(/\n/g) || []).length));
}
function skip(file) {
  return path.relative(root, file).split(path.sep).some(p => skipParts.has(p));
}
function collect(target, out = []) {
  const abs = path.resolve(root, target);
  if (!existsSync(abs) || skip(abs)) return out;
  const st = statSync(abs);
  if (st.isFile()) {
    if (exts.has(path.extname(abs))) out.push(abs);
    return out;
  }
  if (st.isDirectory()) for (const ent of readdirSync(abs)) collect(path.relative(root, path.join(abs, ent)), out);
  return out;
}

const files = [...new Set(roots.flatMap(r => collect(r)))].sort();
const failures = [];
for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const text = stripBlockComments(raw);
  const rawLines = raw.split(/\r?\n/);
  text.split(/\r?\n/).forEach((line, i) => {
    if (rawLines[i]?.includes(allow)) return;
    if (/^\s*\/\//.test(line)) return;
    for (const [label, rx] of blocked) {
      if (rx.test(line)) failures.push(`${path.relative(root, file)}:${i + 1} [${label}] ${line.trim().slice(0, 180)}`);
    }
  });
}

if (failures.length) {
  console.error('Public copy scope guard failed. Current public copy must stay manuscript-first and publishing-facing.');
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Public copy scope guard passed (${files.length} files scanned).`);
