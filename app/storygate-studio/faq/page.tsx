import Link from "next/link";
import type { ReactNode } from "react";

const C = {
  bg: "#0E0E0E",
  text: "#F2EFEA",
  gold: "#A98E4A",
  ash: "#9A9A9A",
  panel: "#161616",
  border: "rgba(161,142,74,0.2)",
  borderAsh: "rgba(154,154,154,0.18)",
} as const;

const creatorSteps = [
  {
    title: "Prepare the manuscript package",
    copy: "The creator gathers the manuscript materials a publishing professional needs to understand the project: query hook, synopsis or overview, author bio, sample pages or manuscript materials, comparables, and positioning notes where useful.",
  },
  {
    title: "Clear the readiness gate",
    copy: "Storygate is designed for prepared manuscript projects. A project may qualify through a RevisionGrade readiness signal or an equivalent professional assessment from a qualified third party.",
  },
  {
    title: "Choose what may be viewed",
    copy: "Creators control project visibility. Storygate should not expose every file by default; it should present only the materials approved for the requesting role and purpose.",
  },
  {
    title: "Review requests and activity",
    copy: "Industry access is requested, approved, and logged. The creator should be able to see who requested access and what project activity occurred inside the controlled environment.",
  },
];

const industrySteps = [
  {
    title: "Request verified access",
    copy: "Publishing professionals request access through the industry pathway. Storygate is not open browsing and not anonymous manuscript shopping.",
  },
  {
    title: "Use role-appropriate review",
    copy: "Approved users see organized manuscript packages appropriate to their role, interest, and creator permissions.",
  },
  {
    title: "Respect creator controls",
    copy: "Materials are made available for professional review inside the account environment. They are not a public download library or uncontrolled sharing surface.",
  },
];

const trustRules = [
  "Projects are not publicly searchable.",
  "Access is verified before manuscript materials are viewed.",
  "Creators approve visibility rather than losing control by default.",
  "Key access actions are logged for accountability.",
  "Storygate does not guarantee representation, publication, sale, placement, or market response.",
  "Storygate currently supports manuscript-first publishing pathways only.",
];

const faqs = [
  {
    q: "What is Storygate Studio?",
    a: "Storygate Studio is a controlled-access layer for readiness-vetted manuscript projects. It helps prepared creators present organized project materials to verified publishing professionals without turning the work into a public listing.",
  },
  {
    q: "Is Storygate a literary agency or publisher?",
    a: "No. Storygate is not an agency, publisher, contest, or marketplace. It is a professional access and presentation layer. Industry response remains subjective and market-dependent.",
  },
  {
    q: "What projects are currently supported?",
    a: "Storygate currently supports manuscript-first publishing pathways: novels, supported memoir or serious nonfiction projects, and complex long-form prose manuscripts.",
  },
  {
    q: "Do I have to buy RevisionGrade services to qualify?",
    a: "No. A RevisionGrade readiness package may satisfy the quality threshold, but equivalent professional manuscript materials or assessment may also qualify.",
  },
  {
    q: "What does a creator need before applying?",
    a: "A creator should have a professional manuscript package: query hook or query letter, synopsis or project overview, author bio, sample pages or manuscript materials, and optional comparables or positioning notes.",
  },
  {
    q: "Who can request industry access?",
    a: "Storygate is intended for legitimate publishing professionals, such as literary agents, acquiring editors, and other qualified publishing-side reviewers. Access should be role-aware and review-purpose aware.",
  },
  {
    q: "Can my project be found by the public?",
    a: "No. Storygate is designed around controlled discovery. Projects are not publicly indexed or available through open browsing.",
  },
  {
    q: "Does Storygate guarantee results?",
    a: "No. Storygate can organize readiness-vetted projects and control access. It cannot guarantee professional interest, representation, publication, sale, placement, or commercial outcome.",
  },
];

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 font-mono text-xs uppercase tracking-[0.22em]" style={{ color: C.gold }}>
      {children}
    </p>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="p-6" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}` }}>
      <h3 className="mb-3 text-lg font-semibold" style={{ color: C.text, fontFamily: "Playfair Display, Georgia, serif" }}>
        {title}
      </h3>
      <div className="text-sm leading-7" style={{ color: C.ash }}>{children}</div>
    </article>
  );
}

export default function StorygateStudioFaqPage() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: C.bg, color: C.text }}>
      <section className="mx-auto max-w-5xl px-6 py-24 text-center" style={{ borderBottom: `1px solid ${C.borderAsh}` }}>
        <SectionLabel>Storygate Studio™ FAQ</SectionLabel>
        <h1 className="mx-auto mb-6 max-w-3xl text-4xl font-bold leading-tight md:text-5xl" style={{ fontFamily: "Playfair Display, Georgia, serif" }}>
          How controlled manuscript access works.
        </h1>
        <p className="mx-auto max-w-2xl text-base leading-8" style={{ color: C.ash }}>
          Storygate Studio is manuscript-first, publishing-facing, and creator-controlled. This page explains who it is for, what materials are involved, how access works, and what Storygate does not promise.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link href="/storygate-studio/apply" className="border px-5 py-3 font-mono text-xs uppercase tracking-[0.18em]" style={{ borderColor: C.gold, backgroundColor: C.gold, color: C.bg }}>
            Prepare a Project
          </Link>
          <Link href="/storygate-studio/industry" className="border px-5 py-3 font-mono text-xs uppercase tracking-[0.18em]" style={{ borderColor: C.gold, color: C.gold }}>
            Request Publishing Access
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <SectionLabel>Creator Process</SectionLabel>
        <h2 className="mb-10 text-3xl font-bold" style={{ fontFamily: "Playfair Display, Georgia, serif" }}>
          For authors preparing a project.
        </h2>
        <div className="grid gap-5 md:grid-cols-2">
          {creatorSteps.map((step) => (
            <Card key={step.title} title={step.title}>{step.copy}</Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-6">
        <SectionLabel>Publishing Access</SectionLabel>
        <h2 className="mb-10 text-3xl font-bold" style={{ fontFamily: "Playfair Display, Georgia, serif" }}>
          For verified publishing professionals.
        </h2>
        <div className="grid gap-5 md:grid-cols-3">
          {industrySteps.map((step) => (
            <Card key={step.title} title={step.title}>{step.copy}</Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <SectionLabel>Access and Privacy Trust</SectionLabel>
        <h2 className="mb-8 text-3xl font-bold" style={{ fontFamily: "Playfair Display, Georgia, serif" }}>
          Controlled discovery, not public exposure.
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {trustRules.map((rule) => (
            <div key={rule} className="p-4 text-sm leading-7" style={{ backgroundColor: C.panel, border: `1px solid ${C.borderAsh}`, color: C.ash }}>
              <span style={{ color: C.gold }}>—</span> {rule}
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-24">
        <SectionLabel>Frequently Asked Questions</SectionLabel>
        <div className="space-y-7">
          {faqs.map((item) => (
            <div key={item.q} className="pb-7" style={{ borderBottom: `1px solid ${C.borderAsh}` }}>
              <h3 className="mb-2 text-lg font-semibold" style={{ fontFamily: "Playfair Display, Georgia, serif" }}>
                {item.q}
              </h3>
              <p className="text-sm leading-7" style={{ color: C.ash }}>
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
