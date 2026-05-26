import Link from "next/link";
import type { ReactNode } from "react";

const commitments = [
  {
    title: "Account-gated workspaces",
    copy: "Evaluation, dashboard, report, revise, and package surfaces must be available only through the user’s authenticated workspace unless the author explicitly exports or shares material.",
  },
  {
    title: "Manuscript storage boundaries",
    copy: "Uploaded manuscripts and generated reports must be treated as private project materials, not public content, marketing samples, or open browsing inventory.",
  },
  {
    title: "Controlled downloads",
    copy: "Report exports must be author-facing files created for the user’s own review, records, and submission preparation. Downloaded files must avoid foregrounding internal job IDs or machine residue.",
  },
  {
    title: "Logged controlled access",
    copy: "Storygate-style project access must be requested, approved, and logged. Controlled manuscript discovery is not the same as public indexing.",
  },
];

const securityBoundaries = [
  {
    name: "Private workspace",
    copy: "The default product experience is the author’s private workspace: uploaded writing, reports, dashboard state, and revision decisions belong inside the account context.",
  },
  {
    name: "Export boundary",
    copy: "The author may download reports or prepared materials. Export is an intentional boundary-crossing action, not an automatic publication event.",
  },
  {
    name: "Storygate boundary",
    copy: "Storygate materials must be creator-approved, access-controlled, and visible only to appropriate verified publishing professionals when the author chooses that path.",
  },
  {
    name: "Admin boundary",
    copy: "Internal operational details, job IDs, raw errors, worker traces, and maintenance controls must not dominate normal author-facing pages.",
  },
];

const authorControls = [
  "Choose whether to evaluate a saved document, uploaded file, or pasted text.",
  "Review the generated report before using it for revision or submission preparation.",
  "Decide whether to accept, reject, keep original, defer, or write a custom repair in Revise.",
  "Use downloads as private records unless the author chooses to share them.",
  "Prepare Storygate or Agent Readiness materials only as author-controlled package outputs.",
];

const notClaims = [
  "No public manuscript indexing by default.",
  "No promise that a completed evaluation makes the manuscript publicly discoverable.",
  "No unsupported claim of agent interest, publication, or sales outcome.",
  "No public exposure of raw operational traces as part of the normal author experience.",
  "No unsupported scripted-media routing as a current public workflow.",
  "No claim here of a formal compliance certification such as SOC 2 unless and until that certification exists.",
];

const faqs = [
  {
    q: "Is this a formal security policy?",
    a: "No. This is a plain-language security and access-control trust page. Formal legal, privacy, and security policies can still define the binding terms for account, data, and infrastructure handling.",
  },
  {
    q: "Can manuscripts appear in public search?",
    a: "No. Manuscripts are private author materials unless the author intentionally exports or approves a controlled package workflow.",
  },
  {
    q: "What must happen when a report is downloaded?",
    a: "The downloaded file must be a professional author-facing artifact: readable, branded, useful for review, and stripped of avoidable machine-looking residue.",
  },
  {
    q: "What must be logged in Storygate-style access?",
    a: "Access requests, approvals, and material-viewing events must be treated as controlled activity. The public promise is controlled manuscript discovery, not open browsing.",
  },
  {
    q: "Where do technical failure details belong?",
    a: "Technical diagnostics belong in support, admin, or operational views. Normal author-facing pages must use clear human status messages and hide raw internals unless needed for support.",
  },
  {
    q: "Does this page claim legal compliance certification?",
    a: "No. It states the intended product trust posture and user-facing access model. Compliance claims must only be added when they are verified and current.",
  },
];

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">{children}</p>;
}

function SectionHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <div className="max-w-4xl">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-4 font-rg-serif text-4xl leading-tight md:text-5xl">{title}</h2>
      <p className="mt-5 text-lg leading-8 text-rg-cream2/75">{copy}</p>
    </div>
  );
}

export default function SecurityPage() {
  return (
    <div className="bg-rg-ink text-rg-cream">
      <section className="mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <Eyebrow>Security & Access Controls</Eyebrow>
          <h1 className="mt-6 max-w-5xl font-rg-serif text-5xl leading-[0.98] tracking-tight md:text-7xl">
            Serious manuscripts need controlled workspaces.
          </h1>
          <p className="mt-8 max-w-3xl text-lg leading-8 text-rg-cream2/85">
            RevisionGrade is designed to feel like a private editorial desk, not a public posting tool. This page explains the security and access-control posture authors can expect when they upload, evaluate, revise, export, or prepare manuscript materials.
          </p>
          <div className="mt-10 flex flex-wrap gap-4 font-rg-mono text-xs uppercase tracking-[0.18em]">
            <Link href="/privacy-research-controls" className="border border-rg-gold bg-rg-gold px-5 py-3 text-rg-ink transition hover:bg-transparent hover:text-rg-gold">Privacy Controls</Link>
            <Link href="/resources" className="border border-rg-cream2/30 px-5 py-3 text-rg-cream transition hover:border-rg-gold hover:text-rg-gold">Resources</Link>
          </div>
        </div>

        <div className="border border-rg-gold/35 bg-rg-ink2/70 p-7">
          <Eyebrow>Plain-language posture</Eyebrow>
          <h2 className="mt-4 font-rg-serif text-3xl leading-tight">Private by default. Shared by author action.</h2>
          <div className="mt-6 space-y-3 text-sm leading-7 text-rg-cream2/80">
            <p>Evaluation work belongs in the author’s account workspace.</p>
            <p>Downloads are deliberate author actions.</p>
            <p>Storygate access must be controlled, approved, and logged.</p>
          </div>
        </div>
      </section>

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <SectionHeading
            eyebrow="Security commitments"
            title="The author-facing experience must reduce exposure, not create it."
            copy="These commitments describe the product posture for uploaded manuscripts, generated reports, revision decisions, downloads, and controlled-access packages."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {commitments.map((item) => (
              <article key={item.title} className="border border-rg-cream2/12 bg-rg-ink/70 p-6">
                <h3 className="font-rg-serif text-2xl text-rg-cream">{item.title}</h3>
                <p className="mt-4 leading-7 text-rg-cream2/75">{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.85fr_1.15fr]">
        <SectionHeading
          eyebrow="Access boundaries"
          title="Every surface needs a clear boundary."
          copy="Authors need to understand which areas are private, which actions create exports, and which package surfaces require explicit approval."
        />
        <div className="space-y-4">
          {securityBoundaries.map((item) => (
            <article key={item.name} className="border border-rg-cream2/12 bg-rg-ink2/60 p-6">
              <h3 className="font-rg-serif text-2xl text-rg-cream">{item.name}</h3>
              <p className="mt-4 leading-7 text-rg-cream2/75">{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr]">
          <SectionHeading
            eyebrow="Author controls"
            title="The author decides when work moves outward."
            copy="Evaluation and revision create private working materials first. Exports, packages, and submissions must be author-directed actions."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {authorControls.map((item) => (
              <div key={item} className="border border-rg-cream2/12 bg-rg-ink/70 p-5 leading-7 text-rg-cream2/80">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHeading
          eyebrow="What this page does not claim"
          title="Security language must stay precise."
          copy="Trust is weakened when public pages claim certifications, workflows, or sharing models the product does not yet support."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {notClaims.map((item) => (
            <div key={item} className="border border-rg-cream2/12 bg-rg-ink2/60 p-5 leading-7 text-rg-cream2/80">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <SectionHeading
            eyebrow="Security FAQ"
            title="Plain answers about access and exposure."
            copy="This page avoids legal or certification overreach. It explains the user-facing trust model in direct language."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {faqs.map((item) => (
              <article key={item.q} className="border border-rg-cream2/12 bg-rg-ink/70 p-6">
                <h3 className="font-rg-serif text-2xl text-rg-cream">{item.q}</h3>
                <p className="mt-4 leading-7 text-rg-cream2/75">{item.a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20 text-center">
        <Eyebrow>Trust by design</Eyebrow>
        <h2 className="mt-5 font-rg-serif text-4xl leading-tight md:text-5xl">
          A manuscript-readiness system must protect the manuscript while it diagnoses it.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl leading-8 text-rg-cream2/75">
          Continue to Privacy & Research Controls for the companion trust doctrine, or begin an evaluation when ready.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4 font-rg-mono text-xs uppercase tracking-[0.18em]">
          <Link href="/privacy-research-controls" className="border border-rg-cream2/30 px-5 py-3 text-rg-cream transition hover:border-rg-gold hover:text-rg-gold">Privacy Controls</Link>
          <Link href="/evaluate" className="border border-rg-gold bg-rg-gold px-5 py-3 text-rg-ink transition hover:bg-transparent hover:text-rg-gold">Begin Evaluation</Link>
        </div>
      </section>
    </div>
  );
}
