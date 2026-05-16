import fs from "node:fs";
import path from "node:path";

const MANIFEST_PATH = path.join(
  process.cwd(),
  "corpus/public-domain/manifest.public-domain.json",
);

type Work = {
  id: string;
  title: string;
  source_download_url?: string;
  raw_text_path: string;
};

type Manifest = {
  works: Work[];
};

function usage(): never {
  console.error(
    [
      "Usage: tsx scripts/corpus/download-public-domain.ts [--id=<work-id>] [--all] [--force]",
      "",
      "Examples:",
      "  npm run corpus:download -- --id=dracula",
      "  npm run corpus:download -- --all",
      "  npm run corpus:download -- --all --force",
    ].join("\n"),
  );
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const args = {
    all: false,
    force: false,
    id: undefined as string | undefined,
  };

  for (const arg of argv) {
    if (arg === "--all") {
      args.all = true;
    } else if (arg === "--force") {
      args.force = true;
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

async function downloadWork(work: Work, force: boolean) {
  if (!work.source_download_url) {
    throw new Error(`${work.id}: missing source_download_url`);
  }

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

  const response = await fetch(work.source_download_url, {
    headers: {
      "User-Agent": "RevisionGrade public-domain corpus downloader (manifest-driven; contact: mikemeraw@gmail.com)",
      Accept: "text/plain, text/*;q=0.9, */*;q=0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`${work.id}: download failed ${response.status} ${response.statusText}`);
  }

  const text = await response.text();

  if (text.trim().length < 100) {
    throw new Error(`${work.id}: downloaded text is suspiciously short`);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, text, "utf8");

  return {
    id: work.id,
    title: work.title,
    status: "downloaded",
    raw_text_path: work.raw_text_path,
    chars: text.length,
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

  const results = [];

  for (const work of selectedWorks) {
    // Sequential by design: be polite to public-domain hosts and keep logs easy to audit.
    results.push(await downloadWork(work, args.force));
  }

  console.log(JSON.stringify({ count: results.length, results }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
