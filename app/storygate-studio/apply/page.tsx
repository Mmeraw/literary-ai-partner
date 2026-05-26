/**
 * /storygate-studio/apply — Creator eligibility + preparation page
 * Public. Canonical Storygate palette.
 *
 * Current public scope: manuscript-first, publishing-facing controlled access.
 */

import Link from "next/link";

const C = {
  bg: "#0E0E0E",
  text: "#F2EFEA",
  gold: "#A98E4A",
  ash: "#7B7B7B",
  panel: "#161616",
  border: "rgba(161,142,74,0.18)",
  borderAsh: "rgba(123,123,123,0.18)",
} as const;

const packageItems = [
  {
    type: "Novels and long-form fiction",
    items: [
      "Query letter with a clear hook paragraph",
      "Synopsis",
      "Author bio",
      "Sample pages or manuscript materials",
      "Optional evaluation summary or readiness assessment",
    ],
  },
  {
    type: "Memoir and supported prose projects",
    items: [
      "Professional query or cover letter",
      "Synopsis or project summary",
      "Author bio with relevant context",
      "Sample pages or manuscript materials",
      "Optional comparables and positioning notes",
    ],
  },
  {
    type: "Complex manuscripts",
    items: [
      "Manuscript package appropriate to the work",
      "Clear genre, audience, and structure positioning",
      "Comparables with rationale where available",
      "Professional readiness evidence",
      "Optional full-manuscript or multi-layer audit summary",
    ],
  },
];

const prepSteps = [
  ["Evaluate", "Upload the manuscript and receive the correct evaluation mode: short-form, long-form, or long-form multi-layer."],
  ["Revise", "Work through the Revise Queue or use TrustedPath™ to address identified weaknesses before submission."],
  ["Agent Readiness Package™", "Generate the query letter, synopsis, query pitch, comparables, and author bio."],
  ["Storygate Submission", "Once the readiness threshold and package approvals are met, Storygate submission can unlock."],
];

export default function StorygateApply() {
  return (
    <main
      style={{ backgroundColor: C.bg, color: C.text, fontFamily: "Inter, system-ui, sans-serif", minHeight: "100vh" }}
    >
      <section className="pt-24 pb-16 px-6 max-w-3xl mx-auto">
        <p className="text-xs tracking-[0.22em] uppercase font-mono mb-4" style={{ color: C.gold }}>
          Storygate Studio™ — Creators
        </p>
        <h1
          className="text-4xl font-bold mb-6 leading-tight"
          style={{ fontFamily: "Playfair Display, Georgia, serif" }}
        >
          Prepare a Manuscript Project for Storygate
        </h1>
        <p className="text-base leading-relaxed mb-4" style={{ color: C.ash }}>
          Storygate Studio is not open to all projects. Placement requires two gates: a professional manuscript package and a minimum readiness threshold.
        </p>
        <p
          className="text-xs px-4 py-3 border"
          style={{ borderColor: C.border, backgroundColor: C.panel, color: C.ash }}
        >
          There is no requirement to purchase RevisionGrade services to qualify. Creators may use equivalent professional materials created independently or through another service.
        </p>
      </section>

      <section
        className="px-6 pb-16 max-w-3xl mx-auto"
        style={{ borderTop: `1px solid ${C.borderAsh}`, paddingTop: "3rem" }}
      >
        <p className="text-xs tracking-[0.18em] uppercase font-mono mb-1" style={{ color: C.gold }}>Gate 1</p>
        <h2
          className="text-2xl font-bold mb-4"
          style={{ fontFamily: "Playfair Display, Georgia, serif" }}
        >
          Professional Manuscript Package
        </h2>
        <p className="text-sm mb-8 leading-relaxed" style={{ color: C.ash }}>
          Your package must be professionally formatted and submission-ready. Current Storygate scope is manuscript-first and publishing-facing.
        </p>

        {packageItems.map(({ type, items }) => (
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
          Your manuscript project must demonstrate a minimum professional standard through one of the following:
        </p>
        <div className="space-y-4">
          <div className="p-6" style={{ border: `1px solid ${C.border}` }}>
            <p className="text-sm font-semibold mb-2" style={{ fontFamily: "Playfair Display, Georgia, serif", color: C.text }}>RevisionGrade Score 8.0+</p>
            <p className="text-sm leading-relaxed" style={{ color: C.ash }}>A RevisionGrade score of 8.0 or higher from a full-manuscript evaluation, not a short excerpt.</p>
          </div>
          <div className="p-6" style={{ border: `1px solid ${C.border}` }}>
            <p className="text-sm font-semibold mb-2" style={{ fontFamily: "Playfair Display, Georgia, serif", color: C.text }}>Equivalent Professional Assessment</p>
            <p className="text-sm leading-relaxed" style={{ color: C.ash }}>A written assessment from a qualified publishing professional confirming the manuscript is submission-ready or professionally prepared.</p>
          </div>
        </div>
      </section>

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
          If you want to use RevisionGrade to build your package and meet Gate 2, the manuscript-first path is:
        </p>
        <div className="space-y-3">
          {prepSteps.map(([step, desc], i) => (
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

      <footer
        className="py-8 px-6 text-center"
        style={{ borderTop: `1px solid ${C.borderAsh}` }}
      >
        <p className="text-xs max-w-xl mx-auto leading-relaxed" style={{ color: C.ash }}>
          Storygate Studio™ does not guarantee representation, publication, placement, or any specific market response. It provides a controlled access environment for professionally prepared manuscript projects.
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
