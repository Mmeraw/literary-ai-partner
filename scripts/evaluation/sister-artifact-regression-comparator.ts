import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import mammoth from 'mammoth';

import { compareSisterArtifacts } from '@/lib/evaluation/qa/sisterArtifactRegressionComparator';

type ManifestEntry = {
  file: string;
  role: string;
};

type CliOptions = {
  rootDir: string;
  baselineFile: string;
  outputFile: string;
  failOnRegression: boolean;
};

const DEFAULT_ROOT = 'docs/qa/sister-renderer-comparison-2026-06-08';
const DEFAULT_OUTPUT = 'sister-artifact-regression-report.json';
const DEFAULT_BASELINE = 'revision-grade-sister (1).txt';

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    rootDir: DEFAULT_ROOT,
    baselineFile: DEFAULT_BASELINE,
    outputFile: DEFAULT_OUTPUT,
    failOnRegression: false,
  };

  for (const arg of argv) {
    if (arg === '--fail-on-regression') {
      options.failOnRegression = true;
      continue;
    }
    if (arg.startsWith('--root=')) {
      options.rootDir = arg.slice('--root='.length);
      continue;
    }
    if (arg.startsWith('--baseline=')) {
      options.baselineFile = arg.slice('--baseline='.length);
      continue;
    }
    if (arg.startsWith('--output=')) {
      options.outputFile = arg.slice('--output='.length);
      continue;
    }
  }

  return options;
}

function extractPrintableText(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  const chunks = raw.match(/[A-Za-z][\x20-\x7E]{4,}/g) ?? [];
  return chunks.join('\n');
}

function normalizeComparableFileName(fileName: string): string {
  return fileName
    .toLowerCase()
    .replace(/\s*\(\d+\)(?=\.[^.]+$)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveManifestFilePath(rootDir: string, manifestFileName: string): string {
  const direct = path.join(rootDir, manifestFileName);
  if (fs.existsSync(direct)) return direct;

  const target = normalizeComparableFileName(manifestFileName);
  const candidates = fs
    .readdirSync(rootDir)
    .filter((name) => normalizeComparableFileName(name) === target)
    .sort();

  if (candidates.length > 0) {
    return path.join(rootDir, candidates[0]!);
  }

  throw new Error(`Artifact referenced in MANIFEST.json does not exist: ${manifestFileName}`);
}

function extractTextFromPdf(absolutePath: string): string {
  const pdftotextCheck = spawnSync('bash', ['-lc', 'command -v pdftotext >/dev/null 2>&1'], {
    stdio: 'ignore',
  });
  if (pdftotextCheck.status === 0) {
    const output = spawnSync('pdftotext', ['-layout', '-nopgbrk', absolutePath, '-'], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    if (output.status === 0 && typeof output.stdout === 'string' && output.stdout.trim().length > 0) {
      return output.stdout;
    }
  }

  const pythonScript = [
    'import sys',
    'from pypdf import PdfReader',
    'reader = PdfReader(sys.argv[1])',
    'parts = []',
    'for page in reader.pages:',
    '    parts.append(page.extract_text() or "")',
    'sys.stdout.write("\\n".join(parts))',
  ].join('\n');
  const pythonOutput = spawnSync('python3', ['-c', pythonScript, absolutePath], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  if (
    pythonOutput.status === 0
    && typeof pythonOutput.stdout === 'string'
    && pythonOutput.stdout.trim().length > 0
  ) {
    return pythonOutput.stdout;
  }

  const bytes = fs.readFileSync(absolutePath);
  return extractPrintableText(bytes);
}

async function extractTextForFile(absolutePath: string): Promise<string> {
  const ext = path.extname(absolutePath).toLowerCase();
  if (ext === '.txt') {
    return fs.readFileSync(absolutePath, 'utf8');
  }
  if (ext === '.docx') {
    const { value } = await mammoth.extractRawText({ path: absolutePath });
    return value;
  }
  if (ext === '.pdf') {
    return extractTextFromPdf(absolutePath);
  }
  throw new Error(`Unsupported artifact extension: ${ext}`);
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const rootDir = path.resolve(options.rootDir);
  const manifestPath = path.join(rootDir, 'MANIFEST.json');

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest file not found: ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as ManifestEntry[];
  if (!Array.isArray(manifest) || manifest.length === 0) {
    throw new Error('MANIFEST.json is empty or invalid.');
  }

  const inputs = await Promise.all(
    manifest.map(async (entry) => {
      const absolutePath = resolveManifestFilePath(rootDir, entry.file);
      return {
        artifactId: entry.file,
        role: entry.role,
        text: await extractTextForFile(absolutePath),
      };
    }),
  );

  const report = compareSisterArtifacts(inputs, options.baselineFile);

  const outputPath = path.join(rootDir, options.outputFile);
  const payload = {
    generatedAt: new Date().toISOString(),
    rootDir,
    report,
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log('[sister-artifact-regression] baseline:', report.baselineArtifactId);
  for (const artifact of report.artifacts) {
    console.log(
      `[sister-artifact-regression] ${artifact.artifactId} coverage=${artifact.presentCheckpoints}/${artifact.totalCheckpoints} contamination=${artifact.contaminationCodes.join(',') || 'none'}`,
    );
  }
  console.log('[sister-artifact-regression] report:', outputPath);

  if (options.failOnRegression) {
    const severe = report.deltasAgainstBaseline.some(
      (delta) => delta.coverageDelta < -0.25 || delta.additionalContaminationAgainstBaseline.length > 0,
    );
    if (severe) {
      console.error('[sister-artifact-regression] regression detected under --fail-on-regression');
      process.exit(1);
    }
  }
}

run().catch((error) => {
  console.error('[sister-artifact-regression] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});