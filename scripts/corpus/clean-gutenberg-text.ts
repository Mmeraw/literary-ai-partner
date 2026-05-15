import fs from "node:fs";
import path from "node:path";

const START_MARKER = /\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i;
const END_MARKER = /\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i;

function usage(): never {
  console.error(
    "Usage: tsx scripts/corpus/clean-gutenberg-text.ts <raw-text-path> <clean-text-path>",
  );
  process.exit(1);
}

export function cleanGutenbergText(input: string): string {
  const normalized = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const startMatch = START_MARKER.exec(normalized);
  const endMatch = END_MARKER.exec(normalized);

  let body = normalized;

  if (startMatch) {
    body = body.slice(startMatch.index + startMatch[0].length);
  }

  if (endMatch) {
    const bodyOffset = startMatch ? startMatch.index + startMatch[0].length : 0;
    const endIndexInBody = endMatch.index - bodyOffset;
    if (endIndexInBody > 0) {
      body = body.slice(0, endIndexInBody);
    }
  }

  return body
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .concat("\n");
}

function assertCorpusPath(filePath: string, expectedSegment: "/public-domain/") {
  const normalizedPath = path.normalize(filePath);
  if (normalizedPath.includes("..")) {
    throw new Error(`Refusing path with parent-directory traversal: ${filePath}`);
  }

  if (!normalizedPath.includes(expectedSegment)) {
    throw new Error(`Expected corpus path containing ${expectedSegment}: ${filePath}`);
  }
}

function main() {
  const [, , rawPath, cleanPath] = process.argv;

  if (!rawPath || !cleanPath) {
    usage();
  }

  assertCorpusPath(rawPath, `${path.sep}public-domain${path.sep}`);
  assertCorpusPath(cleanPath, `${path.sep}public-domain${path.sep}`);

  const absoluteRawPath = path.resolve(process.cwd(), rawPath);
  const absoluteCleanPath = path.resolve(process.cwd(), cleanPath);

  if (!fs.existsSync(absoluteRawPath)) {
    throw new Error(`Raw text file not found: ${rawPath}`);
  }

  const raw = fs.readFileSync(absoluteRawPath, "utf8");
  const cleaned = cleanGutenbergText(raw);

  fs.mkdirSync(path.dirname(absoluteCleanPath), { recursive: true });
  fs.writeFileSync(absoluteCleanPath, cleaned, "utf8");

  console.log(
    JSON.stringify(
      {
        rawPath,
        cleanPath,
        rawChars: raw.length,
        cleanChars: cleaned.length,
        removedChars: raw.length - cleaned.length,
      },
      null,
      2,
    ),
  );
}

if (require.main === module) {
  main();
}
