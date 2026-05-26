import Link from "next/link";
import type { ReactNode } from "react";

const C = {
  bg: "#0E0E0E",
  panel: "#161616",
  border: "rgba(161,142,74,0.2)",
  borderAsh: "rgba(242,239,234,0.12)",
  gold: "#A98E4A",
  cream: "#F2EFEA",
  cream2: "#C8BFB0",
  ash: "#8F877A",
  ink: "#0E0E0E",
} as const;

const classificationPrinciples = [
  {
    title: "Genre is a reader promise",
    copy: "Classification tells the evaluation what kind of experience the manuscript appears to be promising. A literary novel, thriller, Gothic horror story, memoir, and serious nonfiction project do not create the same expectations.",
  },
  {
    title: "Primary shelf comes first",
    copy: "Hybrid manuscripts can carry more than one signal, but the report still needs a stable primary shelf so pacing, closure, marketability, tone, and reader expectations are judged against the right frame.",
  },
  {
    title: "Evidence beats label preference",
    copy: "The system should not blindly accept a genre label if the manuscript evidence points elsewhere. Classification should follow the page, not wishful positioning.",
  },
  {
    title: "Marketability is not genre snobbery",
    copy: "Marketability evaluates whether the manuscript can be positioned clearly for its likely readers. It does not mean every manuscript should become more commercial or more conventional.",
  },
];

const supportedFrames = [
  "Novel / long-form fiction",
  "Literary fiction",
  "Commercial fiction",
  "Mystery / thriller / suspense",
  "Horror / Gothic / supernatural",
  "Historical fiction",
  "Speculative, fantasy, or science-fictional prose",
  "Romance or relationship-driven fiction",
  "Memoir where supported",
  "Serious nonfiction where supported",
  "Genre-hybrid and complex long-form prose",
];

const faqs = [
  {
    q: "Why does genre matter to an evaluation?",
    a: "Genre changes the promise being tested. A thriller needs pressure, threat, escalation, and momentum. A literary novel may tolerate more interiority but still needs authority, movement, and reader trust. Genre does not change the need for craft; it changes the expectation frame.",
  },
  {
    q: "Can RevisionGrade evaluate hybrid manuscripts?",
    a: "Yes. Hybrid manuscripts are common. The key is to identify the primary shelf and the secondary signals without letting the manuscript hide behind ambiguity. A hybrid still needs a readable promise.",
  },
  {
    q: "What if I disagree with the genre label?",
    a: "The author can disagree with a classification, but the useful question is evidentiary: what does the manuscript actually signal on the page? If the opening, tone, stakes, structure, and reader contract point to a different shelf, the package may need repositioning.",
  },
  {
    q: "Does genre affect scoring?",
    a: "Genre affects interpretation, not basic craft standards. Weak stakes, unstable voice, unclear scene function, and missing closure remain problems. Genre helps determine what kind of stakes, voice, scene function, and closure the reader is likely expecting.",
  },
  {
    q: "How does classification affect marketability?",
    a: "Marketability depends partly on whether a manuscript can be described to the right audience. If a book is positioned as one thing but behaves like another, agents and readers may have trouble understanding where it belongs.",
  },
  {
    q: "What is the difference between category, genre, and shelf?",
    a: "Category is the broad publishing lane, such as adult, young adult, middle grade, memoir, or nonfiction. Genre is the story or subject tradition. Shelf is the practical market neighborhood where the manuscript is likely to be compared and discovered.",
  },
  {
    q: "Should a manuscript be changed to fit genre expectations?",
    a: "Not automatically. The goal is not conformity. The goal is clarity. Sometimes the right repair is to strengthen the chosen promise; other times the right move is to reposition the manuscript more accurately.",
  },
  {
    q: "Can a short excerpt determine genre?",
    a: "Only partly. A short-form evaluation can identify visible genre signals, but it should not overclaim full-manuscript classification. Long-form evaluation has more evidence for recurring structure, tonal consistency, and market positioning.",
  },
  {
    q: "Does classification replace human publishing judgment?",
    a: "No. Classification helps organize evidence and reduce confusion. Agents, editors, and readers still bring taste, list needs, timing, and market judgment.",
  },
];

const redFlags = [
  "The label promises one reading experience, but the opening delivers another.",
  "The manuscript uses a genre label to excuse missing pressure, movement, or closure.",
  "The comps point to a market neighborhood the manuscript does not actually inhabit.",
  "The story is described as literary to avoid clarifying stakes or structure.",
  "The story is described as commercial without a clear hook, engine, or audience path.",
  "The package names too many genres and leaves the reader without a primary shelf.",
];

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="font-rg-mono text-xs uppercase tracking-[0.22em]" style={{ color: C.gold }}>{children}</p>;
}

function Card({ title, copy }: { title: string; copy: string }) {
  return (
    <article className="p-6" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}` }}>
      <h3 className="font-rg-serif text-xl" style={{ color: C.cream }}>{title}</h3>
      <p className="mt-3 text-sm leading-7" style={{ color: C.cream2 }}>{copy}</p>
    </article>
  );
}

export default function GenreClassificationFaqPage() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: C.bg, color: C.cream }}>
      <section className="mx-auto max-w-5xl px-6 py-24 text-center" style={{ borderBottom: `1px solid ${C.borderAsh}` }}>
        <Eyebrow>Genre & Classification FAQ</Eyebrow>
        <h1 className="mx-auto mt-5 max-w-4xl font-rg-serif text-4xl font-bold leading-tight md:text-5xl">
          Genre is not decoration. It is the reader promise the manuscript must either fulfill or clarify.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-8" style={{ color: C.cream2 }}>
          RevisionGrade uses classification to frame evidence responsibly. The goal is not to force a manuscript into a box; the goal is to understand what the manuscript is promising and whether the pages support that promise.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link href="/resources" className="border px-5 py-3 font-rg-mono text-xs uppercase tracking-[0.18em]" style={{ borderColor: C.gold, backgroundColor: C.gold, color: C.ink }}>
            Back to Resources
          </Link>
          <Link href="/evaluate" className="border px-5 py-3 font-rg-mono text-xs uppercase tracking-[0.18em]" style={{ borderColor: C.gold, color: C.gold }}>
            Begin Evaluation
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <Eyebrow>Classification Doctrine</Eyebrow>
        <h2 className="mt-4 max-w-3xl font-rg-serif text-3xl font-bold leading-tight md:text-4xl">
          The label should follow the manuscript evidence.
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {classificationPrinciples.map((item) => <Card key={item.title} {...item} />)}
        </div>
      </section>

      <section className="border-y px-6 py-20" style={{ borderColor: C.borderAsh, backgroundColor: "#111111" }}>
        <div className="mx-auto max-w-6xl">
          <Eyebrow>Supported positioning frames</Eyebrow>
          <h2 className="mt-4 max-w-3xl font-rg-serif text-3xl font-bold leading-tight md:text-4xl">
            RevisionGrade should name the publishing lane clearly without overclaiming precision.
          </h2>
          <div className="mt-10 grid gap-3 md:grid-cols-3">
            {supportedFrames.map((frame) => (
              <div key={frame} className="p-4 font-rg-mono text-xs uppercase leading-6 tracking-[0.12em]" style={{ backgroundColor: C.panel, border: `1px solid ${C.borderAsh}`, color: C.cream2 }}>
                {frame}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <Eyebrow>Classification red flags</Eyebrow>
        <h2 className="mt-4 max-w-3xl font-rg-serif text-3xl font-bold leading-tight md:text-4xl">
          The most dangerous classification problem is a confused promise.
        </h2>
        <div className="mt-10 grid gap-3 md:grid-cols-2">
          {redFlags.map((item) => (
            <div key={item} className="p-5 text-sm leading-7" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.cream2 }}>
              <span style={{ color: C.gold }}>—</span> {item}
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-24">
        <Eyebrow>Frequently Asked Questions</Eyebrow>
        <div className="mt-8 space-y-7">
          {faqs.map((item) => (
            <div key={item.q} className="pb-7" style={{ borderBottom: `1px solid ${C.borderAsh}` }}>
              <h3 className="font-rg-serif text-xl font-semibold">{item.q}</h3>
              <p className="mt-2 text-sm leading-7" style={{ color: C.cream2 }}>{item.a}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
