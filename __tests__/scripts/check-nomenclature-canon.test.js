const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  VOCABULARY_DETECTION_ALLOW_MARKER,
  filterAllowedMatches,
  hasVocabularyDetectionAllowMarker,
  parseSearchOutput,
} = require("../../scripts/check-nomenclature-canon.js");

describe("check-nomenclature-canon vocabulary-detection allow marker", () => {
  test("detects the explicit vocabulary-detection allow marker", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "canon-audit-allow-"));
    const filePath = path.join(tmpDir, "allowed.ts");

    fs.writeFileSync(
      filePath,
      `// ${VOCABULARY_DETECTION_ALLOW_MARKER}\nconst terms = ["clarity", "payoff"];\n`,
      "utf8",
    );

    expect(hasVocabularyDetectionAllowMarker(filePath)).toBe(true);
  });

  test("filters matches from allow-marked vocabulary-detection files only", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "canon-audit-filter-"));
    const allowedFile = path.join(tmpDir, "allowed.ts");
    const blockedFile = path.join(tmpDir, "blocked.ts");

    fs.writeFileSync(
      allowedFile,
      `// ${VOCABULARY_DETECTION_ALLOW_MARKER}\nconst detectionTerms = ["clarity", "resolution"];\n`,
      "utf8",
    );
    fs.writeFileSync(
      blockedFile,
      `const canonicalMap = { "clarity": "bad" };\n`,
      "utf8",
    );

    const matches = parseSearchOutput(
      `${allowedFile}:2:const detectionTerms = ["clarity", "resolution"]\n` +
        `${blockedFile}:1:const canonicalMap = { "clarity": "bad" };`,
    );

    const filtered = filterAllowedMatches(matches, tmpDir);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].filePath).toBe(blockedFile);
  });
});
