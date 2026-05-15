import fs from "node:fs";
import path from "node:path";

type Work = {
  id: string;
  title: string;
  author: string;
  form: string;
  clean_text_path: string;
  cleaning: { status: string };
};

type Manifest = {
  works: Work[];
};

const MANIFEST_PATH = path.join(
  process.cwd(),
  "corpus/public-domain/manifest.public-domain.json",
);

function countWords(text: string): number {
  const matches = text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g);
  return matches ? matches.length : 0;
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as Manifest;

  const rows = manifest.works.map((work) => {
    const absoluteCleanPath = path.resolve(process.cwd(), work.clean_text_path);
    const exists = fs.existsSync(absoluteCleanPath);
    const text = exists ? fs.readFileSync(absoluteCleanPath, "utf8") : "";

    return {
      id: work.id,
      title: work.title,
      author: work.author,
      form: work.form,
      cleaning_status: work.cleaning.status,
      clean_text_exists: exists,
      chars: text.length,
      words: countWords(text),
    };
  });

  const totals = rows.reduce(
    (acc, row) => {
      acc.works += 1;
      acc.clean_texts += row.clean_text_exists ? 1 : 0;
      acc.words += row.words;
      acc.chars += row.chars;
      return acc;
    },
    { works: 0, clean_texts: 0, words: 0, chars: 0 },
  );

  console.log(JSON.stringify({ totals, rows }, null, 2));
}

main();
