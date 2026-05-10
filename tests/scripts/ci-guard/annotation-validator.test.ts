import fs from "node:fs";
import path from "node:path";
import { validateEscapeAnnotation, hasNearbyEscapeAnnotation } from "@/scripts/ci-guard/annotation-validator";

const fixture = (name: string) =>
  fs.readFileSync(path.join(process.cwd(), "tests/scripts/ci-guard/fixtures", name), "utf8");

const contract = {
  markerToken: "@InternalOnly",
  requiredValidatorCheck: "path-classification" as const,
  auditLogShape: "ci-summary" as const,
};

describe("ci-guard annotation validator", () => {
  it("detects nearby annotation marker", () => {
    const content = fixture("in-scope-annotated-exception.txt");
    const has = hasNearbyEscapeAnnotation(content, { startOffset: 0, endOffset: 10, lineNumber: 2 }, contract.markerToken);
    expect(has).toBe(true);
  });

  it("rejects annotation on in-scope path under strict path-classification contract", () => {
    const content = fixture("in-scope-annotated-exception.txt");
    const outcome = validateEscapeAnnotation(
      "app/example/page.tsx",
      content,
      { startOffset: 0, endOffset: 10, lineNumber: 2 },
      contract,
    );
    expect(outcome).toBe("rejected-out-of-scope-path");
  });

  it("accepts validator-confirmed annotation on non-user-facing path", () => {
    const content = fixture("in-scope-annotated-exception.txt");
    const outcome = validateEscapeAnnotation(
      "lib/internal/tool.ts",
      content,
      { startOffset: 0, endOffset: 10, lineNumber: 2 },
      contract,
    );
    expect(outcome).toBe("accepted");
  });
});
