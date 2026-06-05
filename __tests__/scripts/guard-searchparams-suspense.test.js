const { analyzeSource } = require("../../scripts/guard-searchparams-suspense.js");

describe("guard-searchparams-suspense", () => {
  test("fails when default export directly calls useSearchParams without Suspense wrapper pattern", () => {
    const src = `
      "use client";
      import { useSearchParams } from "next/navigation";

      export default function BrokenPage() {
        const searchParams = useSearchParams();
        return <main>{searchParams.get("range")}</main>;
      }
    `;

    const failures = analyzeSource("/tmp/app/admin/costs/evaluations/page.tsx", src);
    expect(failures.length).toBeGreaterThan(0);
    expect(failures.join("\n")).toContain("default export directly calls useSearchParams");
  });

  test("fails when useSearchParams is used but no Suspense boundary exists", () => {
    const src = `
      "use client";
      import { useSearchParams } from "next/navigation";

      function Content() {
        const searchParams = useSearchParams();
        return <main>{searchParams.get("range")}</main>;
      }

      export default function Page() {
        return <Content />;
      }
    `;

    const failures = analyzeSource("/tmp/app/admin/costs/evaluations/page.tsx", src);
    expect(failures.length).toBeGreaterThan(0);
    expect(failures.join("\n")).toContain("does not render a <Suspense>");
  });

  test("passes when useSearchParams is isolated behind Suspense", () => {
    const src = `
      "use client";
      import { Suspense } from "react";
      import { useSearchParams } from "next/navigation";

      function Content() {
        const searchParams = useSearchParams();
        return <main>{searchParams.get("range")}</main>;
      }

      export default function Page() {
        return (
          <Suspense fallback={<main>Loading...</main>}>
            <Content />
          </Suspense>
        );
      }
    `;

    const failures = analyzeSource("/tmp/app/admin/costs/evaluations/page.tsx", src);
    expect(failures).toEqual([]);
  });
});
