import fs from "node:fs";
import path from "node:path";

const manifestPath = path.join(
  process.cwd(),
  "corpus/public-domain/manifest.public-domain.json",
);

function countWords(text: string): number {
  const matches = text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g);
  return matches ? matches.length : 0;
}

describe("public-domain corpus extraction guard", () => {
  it("does not allow collection-sized short fiction to masquerade as standalone fixtures", () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    for (const work of manifest.works) {
      if (work.form !== "short_fiction") continue;

      const cleanPath = path.join(process.cwd(), work.clean_text_path);
      if (!fs.existsSync(cleanPath)) continue;

      const wordCount = countWords(fs.readFileSync(cleanPath, "utf8"));
      if (wordCount > 15_000) {
        expect(work.requires_extraction).toBe(true);
        expect(work.cleaning?.notes || "").toContain("extraction");
      }
    }
  });
});
