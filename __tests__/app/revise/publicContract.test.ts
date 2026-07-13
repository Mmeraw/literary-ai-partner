import fs from "node:fs";
import path from "node:path";

describe("public Revise contract copy", () => {
  const pageSource = fs.readFileSync(path.join(process.cwd(), "app/revise/page.tsx"), "utf8");

  it("names the three canonical card types", () => {
    expect(pageSource).toContain("Copy-Paste Rewrite");
    expect(pageSource).toContain("Revision Strategy");
    expect(pageSource).toContain("Held Item");
  });

  it("uses the canonical A/B/C meanings and limits TrustedPath to eligible A", () => {
    expect(pageSource).toContain("A — Recommended repair");
    expect(pageSource).toContain("B — Rhythm variant");
    expect(pageSource).toContain("C — Bolder rendering shift");
    expect(pageSource).toContain("Applies A only on eligible Copy-Paste cards");
  });

  it("does not regress to the former shared-card vocabulary", () => {
    expect(pageSource).not.toContain("B—Conservative");
    expect(pageSource).not.toContain("Reject all three");
    expect(pageSource).not.toContain("A / B / C repair options with rationale");
  });
});
