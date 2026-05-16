import fs from "node:fs";
import path from "node:path";

const MANIFEST_PATH = path.join(
  process.cwd(),
  "corpus/public-domain/manifest.public-domain.json",
);

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRIES = 2;
const RETRY_DELAY_MS = 1_500;

type Work = {
  id: string;
  title: string;
  source_download_url?: string;
  raw_text_path: string;
};

type Manifest = {
  works: Work[];
};

type DownloadResult =
  | {
      id: string;
      title: string;
      status: "downloaded";
      raw_text_path: string;
      chars: number;
      source_download_url: string;
      attempts: number;
    }
  | {
      id: string;
      title: string;
      status: "skipped_exists";
      raw_text_path: string;
    }
  | {
      id: string;
      title: string;
      status: "failed";
      raw_text_path: string;
      source_download_url?: string;
      attempts: number;
      error: string;
    };

function usage(): never {
  console.error(
    [
      "Usage: tsx scripts/corpus/download-public-domain.ts [--id=<work-id>] [--all] [--force] [--fail-fast]",
      "",
      "Examples:",
      "  npm run corpus:download -- --id=dracula",
      "  npm run corpus:download -- --all",
      "  npm run corpus:download -- --all --force",
      "  npm run corpus:download -- --all --fail-fast",
    ].join("\n"),
  );
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const args = {
    all: false,
    force: false,
    failFast: false,
    id: undefined as string | undefined,
  };

  for (const arg of argv) {
    if (arg === "--all") {
      args.all = true;
    } else if (arg === "--force") {
      args.force = true;
    } else if (arg === "--fail-fast") {
      args.failFast = true;
    } else if (arg.startsWith("--id=")) {
      args.id = arg.slice("--id=".length);
    } else {
      usage();
    }
  }

  if (!args.all && !args.id) {
    usage();
  }

  if (args.all && args.id) {
    throw new Error("Use either --all or --id=<work-id>, not both.");
  }

  return args;
}

function assertSafeCorpusPath(filePath: string) {
  const normalized = path.normalize(filePath);

  if (!normalized.startsWith(path.normalize("corpus/public-domain/raw/"))) {
    throw new Error(`Refusing to write outside corpus/public-domain/raw/: ${filePath}`);
  }

  if (normalized.includes("..")) {
    throw new Error(`Refusing path with parent-directory traversal: ${filePath}`);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function fetchTextWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "RevisionGrade public-domain corpus downloader (manifest-driven; contact: mikemeraw@gmail.com)",
        Accept: "text/plain, text/*;q=0.9, */*;q=0.1",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadWork(work: Work, force: boolean): Promise<DownloadResult> {
  assertSafeCorpusPath(work.raw_text_path);

  const outputPath = path.resolve(process.cwd(), work.raw_text_path);

  if (fs.existsSync(outputPath) && !force) {
    return {
      id: work.id,
      title: work.title,
      status: "skipped_exists",
      raw_text_path: work.raw_text_path,
    };
  }

  if (!work.source_download_url) {
    return {
      id: work.id,
      title: work.title,
      status: "failed",
      raw_text_path: work.raw_text_path,
      attempts: 0,
      error: "missing source_download_url",
    };
  }

  let lastError = "unknown download error";

  for (let attempt = 1; attempt <= DEFAULT_RETRIES + 1; attempt += 1) {
    try {
      const text = await fetchTextWithTimeout(work.source_download_url, DEFAULT_TIMEOUT_MS);

      if (text.trim().length < 100) {
        throw new Error("downloaded text is suspiciously short");
      }

      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, text, "utf8");

      return {
        id: work.id,
        title: work.title,
        status: "downloaded",
        raw_text_path: work.raw_text_path,
        source_download_url: work.source_download_url,
        chars: text.length,
        attempts: attempt,
      };
    } catch (error) {
      lastError = formatError(error);

      if (attempt <= DEFAULT_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  return {
    id: work.id,
    title: work.title,
    status: "failed",
    raw_text_path: work.raw_text_path,
    source_download_url: work.source_download_url,
    attempts: DEFAULT_RETRIES + 1,
    error: lastError,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
  const selectedWorks = args.all
    ? manifest.works
    : manifest.works.filter((work) => work.id === args.id);

  if (selectedWorks.length === 0) {
    throw new Error(`No manifest work matched id: ${args.id}`);
  }

  const results: DownloadResult[] = [];

  for (const work of selectedWorks) {
    // Sequential by design: be polite to public-domain hosts and keep logs easy to audit.
    console.error(`[corpus:download] ${work.id} — ${work.title}`);
    const result = await downloadWork(work, args.force);
    results.push(result);

    if (result.status === "failed") {
      console.error(
        `[corpus:download] FAILED ${work.id}: ${result.error}` +
          (result.source_download_url ? ` (${result.source_download_url})` : ""),
      );

      if (args.failFast) {
        break;
      }
    }
  }

  const summary = results.reduce(
    (acc, result) => {
      acc[result.status] = (acc[result.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  console.log(JSON.stringify({ count: results.length, summary, results }, null, 2));

  if (results.some((result) => result.status === "failed")) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
