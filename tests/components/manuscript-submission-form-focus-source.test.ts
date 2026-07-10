import fs from "node:fs";
import path from "node:path";

describe("ManuscriptSubmissionForm focus stability", () => {
  it("declares focusable field component types outside the stateful form", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "components/evaluation/ManuscriptSubmissionForm.jsx"),
      "utf8",
    );

    const formIndex = source.indexOf("export default function ManuscriptSubmissionForm");
    expect(formIndex).toBeGreaterThan(0);
    expect(source.indexOf("function FocusableInput")).toBeGreaterThan(0);
    expect(source.indexOf("function FocusableInput")).toBeLessThan(formIndex);
    expect(source.indexOf("function FocusableSelect")).toBeLessThan(formIndex);
    expect(source.indexOf("function FocusableTextarea")).toBeLessThan(formIndex);
    expect(source.indexOf('id=\"project-title\"')).toBeGreaterThan(formIndex);
  });
});
