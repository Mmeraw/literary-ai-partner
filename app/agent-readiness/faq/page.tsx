import Link from "next/link";
import type { ReactNode } from "react";

const C = {
  bg: "#0F0D0A",
  panel: "#1A1612",
  border: "#2A2420",
  gold: "#A98E4A",
  cream: "#F2EFEA",
  cream2: "#C8BFB0",
  dim: "#7B7060",
  ink: "#0E0E0E",
} as const;

const packageSections = [
  {
    title: "Query letter",
    body: "The professional letter that introduces the manuscript, hook, category, word count, comparable titles, author context, and closing. It should be clear, restrained, and ready for agent submission.",
  },
  {
    title: "Query pitch",
    body: "A compact hook or one-sentence positioning line used inside query forms and submission materials. It is not a separate hype document; it supports the query package.",
  },
  {
    title: "Synopsis",
    body: "A clear summary of the story, including the ending. The synopsis shows whether the manuscript has coherent plot movement, stakes, escalation, and resolution.",
  },
  {
    title: "Comparables",
    body: "A small set of useful comparison titles with rationale. Good comps help locate the manuscript on the publishing shelf without pretending the book is identical to anything else.",
  },
  {
    title: "Author bio",
    body: "A professional bio built from author-supplied facts only. RevisionGrade should not invent credentials, awards, publications, platform, or personal history.",
  },
  {
    title: "Package export",
    body: "A final approved package the author can review, save, and export after all required sections are complete and approved.",
  },
];

const approvalRules = [
  "Each section should be reviewed before export.",
  "Author bio content must come from author-provided information.",
  "Comparables should be plausible and explained, not name-dropped.",
  "The query letter should stay focused on manuscript submission, not broad promotion.",
  "Package approval does not guarantee agent interest, representation, publication, or market outcome.",
];

const faqs = [
  {
    q: "What is Agent Readiness Package™?",
    a: "Agent Readiness Package™ helps an author prepare the core materials used for manuscript submission: query letter, query pitch, synopsis, comparables, author bio, manuscript positioning, and package export.",
  },
  {
    q: "Is this the same as a manuscript evaluation?",
    a: "No. Evaluation diagnoses manuscript readiness. Agent Readiness prepares submission materials after the manuscript is ready enough to present. A strong package cannot compensate for a structurally unready manuscript.",
  },
  {
    q: "Should I use Agent Readiness before evaluation?",
    a: "Usually no. The safer path is to diagnose readiness first, revise what needs repair, then build submission materials. Otherwise, the package may make a weak manuscript look polished without solving the underlying problem.",
  },
  {
    q: "What does the query letter include?",
    a: "The query letter should include the hook, manuscript metadata, category or shelf, concise story positioning, comparable titles where useful, a short author bio, and a professional closing.",
  },
  {
    q: "What is a query pitch?",
    a: "A query pitch is a short manuscript positioning line or hook that helps communicate the project quickly in query forms and package summaries. It should support the query letter rather than replace it.",
  },
  {
    q: "Why does the synopsis reveal the ending?",
    a: "Agents and publishing professionals use a synopsis to understand the full narrative arc. A synopsis is not back-cover copy; it should show how the story resolves.",
  },
  {
    q: "Can RevisionGrade invent an author bio for me?",
    a: "No. Author bios must be based on author-supplied facts. RevisionGrade can shape, compress, and professionalize the bio, but it should not invent credentials or personal history.",
  },
  {
    q: "What makes a good comparable title?",
    a: "A good comp helps identify audience, shelf, tone, structure, or market neighborhood. It should come with a reason: what the manuscript shares with the comp and where it differs.",
  },
  {
    q: "Does a polished package guarantee an agent response?",
    a: "No. A polished package can improve clarity and professionalism, but it cannot control agent taste, timing, list needs, or market appetite.",
  },
];

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="font-rg-mono text-xs uppercase tracking-[0.22em]" style={{ color: C.gold }}>{children}</p>;
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <article className="p-6" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}` }}>
      <h3 className="mb-3 font-rg-serif text-xl" style={{ color: C.cream }}>{title}</h3>
      <p className="text-sm leading-7" style={{ color: C.cream2 }}>{body}</p>
    </article>
  );
}

export default function AgentReadinessFaqPage() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: C.bg, color: C.cream }}>
      <section className="mx-auto max-w-5xl px-6 py-24 text-center" style={{ borderBottom: `1px solid ${C.border}` }}>
        <SectionLabel>Agent Readiness Package™ FAQ</SectionLabel>
        <h1 className="mx-auto mt-5 max-w-3xl font-rg-serif text-4xl font-bold leading-tight md:text-5xl">
          Build submission materials only after the manuscript is ready to be represented clearly.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-8" style={{ color: C.cream2 }}>
          Agent Readiness is the manuscript submission package layer: query letter, query pitch, synopsis, comparables, author bio, approval, and export. It is not a substitute for manuscript diagnosis.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link href="/agent-readiness" className="border px-5 py-3 font-rg-mono text-xs uppercase tracking-[0.18em]" style={{ borderColor: C.gold, backgroundColor: C.gold, color: C.ink }}>
            Open Agent Readiness
          </Link>
          <Link href="/evaluate" className="border px-5 py-3 font-rg-mono text-xs uppercase tracking-[0.18em]" style={{ borderColor: C.gold, color: C.gold }}>
            Diagnose Readiness First
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <SectionLabel>Package Sections</SectionLabel>
        <h2 className="mt-4 mb-10 font-rg-serif text-3xl font-bold">What the package contains.</h2>
        <div className="grid gap-5 md:grid-cols-2">
          {packageSections.map((section) => <Card key={section.title} {...section} />)}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-4">
        <SectionLabel>Approval Doctrine</SectionLabel>
        <h2 className="mt-4 mb-8 font-rg-serif text-3xl font-bold">The author approves the package before export.</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {approvalRules.map((rule) => (
            <div key={rule} className="p-4 text-sm leading-7" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.cream2 }}>
              <span style={{ color: C.gold }}>—</span> {rule}
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-20">
        <SectionLabel>Frequently Asked Questions</SectionLabel>
        <div className="mt-8 space-y-7">
          {faqs.map((item) => (
            <div key={item.q} className="pb-7" style={{ borderBottom: `1px solid ${C.border}` }}>
              <h3 className="mb-2 font-rg-serif text-lg font-semibold">{item.q}</h3>
              <p className="text-sm leading-7" style={{ color: C.cream2 }}>{item.a}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
