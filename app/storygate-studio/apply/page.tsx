/**
 * /storygate-studio/apply — Creator eligibility + preparation page
 * Public. Canonical Storygate palette.
 */

import Link from "next/link";

const C = {
  bg:        "#0E0E0E",
  text:      "#F2EFEA",
  gold:      "#A98E4A",
  oxblood:   "#7A1E1E",
  ash:       "#7B7B7B",
  panel:     "#161616",
  border:    "rgba(161,142,74,0.18)",
  borderAsh: "rgba(123,123,123,0.18)",
} as const;

export default function StorygateApply() {
  return (
    <main
      style={{ backgroundColor: C.bg, color: C.text, fontFamily: "Inter, system-ui, sans-serif", minHeight: "100vh" }}
    >
      {/* Header */}
      <section className="pt-24 pb-16 px-6 max-w-3xl mx-auto">
        <p className="text-xs tracking-[0.22em] uppercase font-mono mb-4" style={{ color: C.gold }}>
          Storygate Studio™ — Creators
        </p>
        <h1
          className="text-4xl font-bold mb-6 leading-tight"
          style={{ fontFamily: "Playfair Display, Georgia, serif" }}
        >
          Prepare a Project for Storygate
        </h1>
        <p className="text-base leading-relaxed mb-4" style={{ color: C.ash }}>
          Storygate Studio is not open to all projects. Placement requires two gates — a professional presentation package and a minimum readiness threshold. Here is what you need to prepare.
        </p>
        <p
          className="text-xs px-4 py-3 border"
          style={{ borderColor: C.border, backgroundColor: C.panel, color: C.ash }}
        >
          There is no requirement to purchase RevisionGrade services to qualify. Creators may use equivalent professional materials created independently or through another service.
        </p>
      </section>

      {/* Gate 1 */}
      <section
        className="px-6 pb-16 max-w-3xl mx-auto"
        style={{ borderTop: `1px solid ${C.borderAsh}`, paddingTop: "3rem" }}
      >
        <p className="text-xs tracking-[0.18em] uppercase font-mono mb-1" style={{ color: C.gold }}>Gate 1</p>
        <h2
          className="text-2xl font-bold mb-4"
          style={{ fontFamily: "Playfair Display, Georgia, serif" }}
        >
          Professional Presentation Package
        </h2>
        <p className="text-sm mb-8 leading-relaxed" style={{ color: C.ash }}>
          Depending on project type, your package must include the relevant materials below. All materials must be professionally formatted and submission-ready — not works in progress.
        </p>

        {[
          {
            type: "Manuscript / Publishing",
            items: ["Query letter or professional pitch material", "Synopsis or series overview", "Author bio", "Sample pages (typically first 10–50 pages)", "Optional: evaluation summary or readiness assessment"],
          },
          {
            type: "Screen / Adaptation",
            items: ["Film/TV pitch deck or equivalent screen-development package", "Source-material summary", "Lookbook (optional but recommended)", "Comparable titles and audience positioning", "Optional: adaptation notes or development memo"],
          },
          {
            type: "Series / Franchise",
            items: ["Series overview", "World or character materials", "Adaptation positioning", "Multi-volume or multi-season development package"],
          },
        ].map(({ type, items }) => (
          <div key={type} className="mb-6 p-6" style={{ backgroundColor: C.panel, border: `1px solid ${C.borderAsh}` }}>
            <p className="text-xs tracking-[0.14em] uppercase font-mono mb-4" style={{ color: C.gold }}>{type}</p>
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm" style={{ color: C.ash }}>
                  <span style={{ color: C.gold, flexShrink: 0, marginTop: 2 }}>—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* Gate 2 */}
      <section
        className="px-6 pb-16 max-w-3xl mx-auto"
        style={{ borderTop: `1px solid ${C.borderAsh}`, paddingTop: "3rem" }}
      >
        <p className="text-xs tracking-[0.18em] uppercase font-mono mb-1" style={{ color: C.gold }}>Gate 2</p>
        <h2
          className="text-2xl font-bold mb-4"
          style={{ fontFamily: "Playfair Display, Georgia, serif" }}
        >
          Minimum Readiness Threshold
        </h2>
        <p className="text-sm mb-8 leading-relaxed" style={{ color: C.ash }}>
          Your project must demonstrate a minimum professional standard through one of the following:
        </p>
        <div className="space-y-4">
          {[
            {
              label: "RevisionGrade Score 8.0+",
              desc: "A RevisionGrade evaluation score of 8.0 or higher in the relevant manuscript or script evaluation. The score must be from a full-manuscript evaluation, not an excerpt.",
            },
            {
              label: "Equivalent Professional Assessment",
              desc: "A written assessment from a qualified third party — a literary agent, acquiring editor, producer, development executive, or recognized industry evaluator — confirming the project is submission-ready or professionally prepared.",
            },
          ].map(({ label, desc }) => (
            <div key={label} className="p-6" style={{ border: `1px solid ${C.border}` }}>
              <p className="text-sm font-semibold mb-2" style={{ fontFamily: "Playfair Display, Georgia, serif", color: C.text }}>{label}</p>
              <p className="text-sm leading-relaxed" style={{ color: C.ash }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How to use RevisionGrade */}
      <section
        className="px-6 pb-16 max-w-3xl mx-auto"
        style={{ borderTop: `1px solid ${C.borderAsh}`, paddingTop: "3rem" }}
      >
        <h2
          className="text-xl font-bold mb-4"
          style={{ fontFamily: "Playfair Display, Georgia, serif" }}
        >
          Using RevisionGrade to Prepare
        </h2>
        <p className="text-sm mb-8 leading-relaxed" style={{ color: C.ash }}>
          If you want to use RevisionGrade to build your package and meet Gate 2, the path is:
        </p>
        <div className="space-y-3">
          {[
            ["Evaluate", "Upload your full manuscript. Receive a scored evaluation across the literary criteria canon."],
            ["Revise", "Work through the revision queue to address identified weaknesses before submission."],
            ["Agent Readiness Package™", "Generate your query letter, synopsis, elevator pitch, comparables, and author bio."],
            ["Storygate Submission", "Once your score reaches 8.0+ and all package sections are approved, the Storygate submission option unlocks."],
          ].map(([step, desc], i) => (
            <div key={step} className="flex items-start gap-4 px-4 py-3" style={{ backgroundColor: C.panel, border: `1px solid ${C.borderAsh}` }}>
              <span className="font-mono text-xs shrink-0 mt-0.5" style={{ color: C.gold }}>0{i + 1}</span>
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.1em] mb-1" style={{ color: C.text }}>{step}</p>
                <p className="text-xs leading-relaxed" style={{ color: C.ash }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/evaluate"
            className="inline-block px-6 py-3 text-xs tracking-[0.18em] uppercase font-mono transition-opacity hover:opacity-80"
            style={{ backgroundColor: C.gold, color: C.bg }}
          >
            Start with Evaluate
          </Link>
          <Link
            href="/agent-readiness"
            className="inline-block px-6 py-3 text-xs tracking-[0.18em] uppercase font-mono transition-opacity hover:opacity-80"
            style={{ backgroundColor: "transparent", color: C.gold, border: `1px solid ${C.gold}` }}
          >
            Build Your Package
          </Link>
        </div>
      </section>

      {/* Footer note */}
      <footer
        className="py-8 px-6 text-center"
        style={{ borderTop: `1px solid ${C.borderAsh}` }}
      >
        <p className="text-xs max-w-xl mx-auto leading-relaxed" style={{ color: C.ash }}>
          Storygate Studio™ does not guarantee representation, publication, sale, option, financing, or production. It provides a controlled access environment for professionally prepared projects.
        </p>
        <p className="mt-4">
          <Link href="/storygate-studio" className="text-xs font-mono tracking-[0.14em] uppercase transition-opacity hover:opacity-70" style={{ color: C.gold }}>
            ← Back to Storygate Studio Overview
          </Link>
        </p>
      </footer>
    </main>
  );
}
