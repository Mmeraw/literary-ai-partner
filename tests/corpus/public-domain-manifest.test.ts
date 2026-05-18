import fs from "node:fs";
import path from "node:path";
import { cleanGutenbergText } from "@/scripts/corpus/clean-gutenberg-text";

const manifestPath = path.join(
  process.cwd(),
  "corpus/public-domain/manifest.public-domain.json",
);

describe("public-domain corpus substrate", () => {
  it("keeps the manifest present and parseable", () => {
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    expect(manifest.schema_version).toBe(1);
    expect(Array.isArray(manifest.works)).toBe(true);
    expect(manifest.works).toHaveLength(10);
  });

  it("requires each manifest work to carry provenance, download, calibration, and cleaning state", () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    for (const work of manifest.works) {
      expect(work.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(work.title).toEqual(expect.any(String));
      expect(work.author).toEqual(expect.any(String));
      expect(work.first_publication_year).toEqual(expect.any(Number));
      expect(work.source_name).toEqual(expect.any(String));
      expect(work.source_url).toMatch(/^https?:\/\//);
      expect(work.source_download_url).toMatch(/^https?:\/\/.+\.txt(?:\.utf-8)?$/);
      expect(work.jurisdiction_basis).toEqual(expect.any(String));
      expect(Array.isArray(work.calibration_axes)).toBe(true);
      expect(work.calibration_axes.length).toBeGreaterThan(0);
      expect(work.raw_text_path).toMatch(/^corpus\/public-domain\/raw\/.+\.txt$/);
      expect(work.clean_text_path).toMatch(/^corpus\/public-domain\/clean\/.+\.txt$/);
      expect(Array.isArray(work.allowed_uses)).toBe(true);
      expect(work.allowed_uses.length).toBeGreaterThan(0);
      expect(work.cleaning).toMatchObject({
        status: expect.any(String),
        headers_removed: expect.any(Boolean),
        footers_removed: expect.any(Boolean),
        modern_editorial_material_removed: expect.any(Boolean),
      });
    }
  });

  it("covers multiple forms and calibration axes in the seed set", () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const forms = Array.from(
      new Set(manifest.works.map((work: { form: string }) => work.form)),
    );
    const axes = Array.from(
      new Set(
        manifest.works.flatMap((work: { calibration_axes: string[] }) => work.calibration_axes),
      ),
    );

    expect(forms).toEqual(
      expect.arrayContaining(["short_fiction", "novella", "novel", "long_novel"]),
    );
    expect(axes).toEqual(
      expect.arrayContaining([
        "dialogue",
        "psychological_horror",
        "science_fiction",
        "childrens_fantasy",
        "detective_fiction",
        "long_form_evidence_coverage",
      ]),
    );
  });

  it("strips Project Gutenberg boilerplate from raw text", () => {
    const raw = [
      "Header text that should be removed",
      "*** START OF THE PROJECT GUTENBERG EBOOK SAMPLE ***",
      "",
      "CHAPTER I",
      "Story text remains.",
      "",
      "*** END OF THE PROJECT GUTENBERG EBOOK SAMPLE ***",
      "Footer text that should be removed",
    ].join("\n");

    const cleaned = cleanGutenbergText(raw);

    expect(cleaned).toContain("CHAPTER I");
    expect(cleaned).toContain("Story text remains.");
    expect(cleaned).not.toContain("Header text");
    expect(cleaned).not.toContain("Footer text");
    expect(cleaned).not.toContain("PROJECT GUTENBERG EBOOK");
  });
});
