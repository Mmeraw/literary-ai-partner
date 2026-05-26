import Link from "next/link";
import type { ReactNode } from "react";

const pillars = [
  {
    title: "Manuscript Sovereignty",
    copy: "Your manuscript remains your creative property. RevisionGrade evaluates submitted text to produce editorial diagnosis and revision options; it does not claim authorship or replace the writer’s judgment.",
  },
  {
    title: "Evidence Before Authority",
    copy: "Findings should be traceable to the manuscript. A score or recommendation is not useful unless it is tied to evidence, severity, reader effect, and revision priority.",
  },
  {
    title: "Author-in-the-Loop",
    copy: "No proposed repair becomes final authorial text without author choice. The author may accept, reject, defer, keep original, or write a custom revision.",
  },
  {
    title: "Scope Discipline",
    copy: "RevisionGrade distinguishes structural diagnosis, scene repair, line polish, market positioning, and voice protection before recommending an intervention.",
  },
];

const practiceRules = [
  {
    title: "Evidence over taste",
    copy: "The report should not ask an author to change the manuscript because a system or reader simply prefers another style. Major findings should point to what the text is doing, where the reader effect changes, and why the issue matters.",
  },
  {
    title: "Diagnosis before polish",
    copy: "Sentence polish can make a structurally weak manuscript look cleaner without making it stronger. RevisionGrade should identify whether the problem is architectural, scene-level, voice-level, market-positioning, or local prose control before proposing repair.",
  },
  {
    title: "Structure before sentence repair",
    copy: "A scene with missing pressure, collapsed agency, unresolved promise, or weak causal logic should not be treated as a line-editing problem. Repair must start at the right level of story behavior.",
  },
  {
    title: "AI as instrument, not authority",
    copy: "RevisionGrade can diagnose, organize, compare, and recommend. It should not impersonate final creative authority. The author decides what enters the manuscript.",
  },
  {
    title: "No blind rewriting",
    copy: "Revision recommendations should not become automatic replacement text without an explicit author path. Even TrustedPath™ must preserve the original, create a duplicate draft, and leave a review trail.",
  },
  {
    title: "Voice protection as a constraint",
    copy: "Unusual voice is not automatically error. The system should warn when a repair may flatten rhythm, erase idiolect, over-compress lyricism, or normalize a deliberate stylistic choice.",
  },
];

const mayDo = [
  "Diagnose structural weaknesses and readiness risks.",
  "Identify evidence from the manuscript and explain reader effect.",
  "Rank findings by severity, confidence, and revision leverage.",
  "Suggest repair directions or A/B/C revision options.",
  "Warn when a suggested change risks damaging voice.",
  "Help organize revision priorities into a controlled path.",
];

const mustNotDo = [
  "Pretend to guarantee representation, publication, sales, or market timing.",
  "Rewrite by default or override author judgment.",
  "Treat smoother prose as automatically better prose.",
  "Flatten style because it is unusual, regional, lyrical, fragmented, or difficult.",
  "Apply the same intervention level to every manuscript or every passage.",
  "Expose internal mechanics or operational traces as if they were the author-facing product.",
];

const editorScopeProblems = [
  {
    problem: "Fine polish when structure is broken",
    response: "RevisionGrade should identify whether the manuscript first needs structural repair, continuity work, pressure restoration, scene reconstruction, or only local prose cleanup.",
  },
  {
    problem: "Taste disguised as diagnosis",
    response: "The system should separate subjective preference from evidence-backed reader effect. A recommendation needs a reason grounded in the manuscript.",
  },
  {
    problem: "Taking the wrong job",
    response: "Scope discipline means saying what kind of intervention the manuscript appears to need, instead of pretending every problem can be solved by the same service.",
  },
  {
    problem: "Voice treated as defect",
    response: "Voice protection means the system must distinguish error from deliberate style, and flag repairs that may over-normalize the prose.",
  },
];

const workflow = [
  {
    step: "Evaluate",
    copy: "Read through stable criteria and evidence rather than vibes, encouragement, or generic bestseller logic.",
  },
  {
    step: "Diagnose",
    copy: "Name the failure level: structure, continuity, pressure, scene construction, voice, prose control, market fit, or readiness risk.",
  },
  {
    step: "Constrain",
    copy: "Protect voice, preserve author intent, avoid invented information, and avoid applying polish where structural repair is required.",
  },
  {
    step: "Decide",
    copy: "Present the repair opportunity to the author. The author accepts, rejects, keeps original, defers, writes custom, or uses a governed automation path.",
  },
];

const limits = [
  "RevisionGrade does not guarantee representation, publication, sales, or market demand.",
  "RevisionGrade does not rewrite by default or override author judgment.",
  "RevisionGrade does not treat smoother prose as automatically better prose.",
  "RevisionGrade does not pretend every manuscript needs the same level of intervention.",
  "RevisionGrade does not claim short excerpts can support full-manuscript continuity conclusions.",
  "RevisionGrade does not replace legal, publishing, editorial, or agent-specific professional judgment.",
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

export default function ReliabilityPage() {
  return (
    <div className="bg-rg-ink text-rg-cream">
      <section className="mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <Eyebrow>Reliability · Editorial Doctrine</Eyebrow>
          <h1 className="mt-6 max-w-5xl font-rg-serif text-5xl leading-[0.98] tracking-tight md:text-7xl">
            Trust means evidence, restraint, and author control.
          </h1>
          <p className="mt-8 max-w-3xl text-lg leading-8 text-rg-cream2/85">
            RevisionGrade is a governed manuscript-readiness system. It is not a remote human-editing service, not an autonomous writing assistant, and not a style-imitation system trained to flatten the writer’s prose.
          </p>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-rg-cream2/75">
            The problem is not human editing. The problem is ungoverned editing: feedback without stable criteria, polish before diagnosis, and revision without clear author control.
          </p>
          <div className="mt-10 flex flex-wrap gap-4 font-rg-mono text-xs uppercase tracking-[0.18em]">
            <Link href="/methodology" className="border border-rg-gold bg-rg-gold px-5 py-3 text-rg-ink transition hover:bg-transparent hover:text-rg-gold">Read Methodology</Link>
            <Link href="/revise" className="border border-rg-cream2/30 px-5 py-3 text-rg-cream transition hover:border-rg-gold hover:text-rg-gold">See Revise</Link>
          </div>
        </div>

        <div className="border border-rg-gold/35 bg-rg-ink2/70 p-7">
          <Eyebrow>Core line</Eyebrow>
          <h2 className="mt-4 font-rg-serif text-3xl leading-tight">Evidence, not authority. Proposals, not control.</h2>
          <div className="mt-6 space-y-3 text-sm leading-7 text-rg-cream2/80">
            <p>A score without evidence is not useful.</p>
            <p>A recommendation without scope is not safe.</p>
            <p>A revision without author choice is not RevisionGrade.</p>
          </div>
        </div>
      </section>

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <SectionHeading
            eyebrow="Trust principles"
            title="Four principles protect the author and the manuscript."
            copy="Reliability is not just uptime or report completion. For RevisionGrade, reliability means the product makes bounded, evidence-backed claims and keeps creative authority with the writer."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {pillars.map((pillar) => (
              <article key={pillar.title} className="border border-rg-cream2/12 bg-rg-ink/70 p-6">
                <h3 className="font-rg-serif text-2xl text-rg-cream">{pillar.title}</h3>
                <p className="mt-4 leading-7 text-rg-cream2/75">{pillar.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <SectionHeading
          eyebrow="What reliability means in practice"
          title="The system must know the level of intervention before asking the writer to change the work."
          copy="A manuscript that needs structural repair should not receive only surface polish. A scene that needs pressure should not be smoothed until it loses force. A voice that is unusual should not be normalized merely because it is unusual."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {practiceRules.map((rule) => (
            <article key={rule.title} className="border border-rg-cream2/12 bg-rg-ink2/60 p-6">
              <h3 className="font-rg-serif text-2xl text-rg-cream">{rule.title}</h3>
              <p className="mt-4 leading-7 text-rg-cream2/75">{rule.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-rg-cream text-rg-ink">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Scope discipline</p>
            <h2 className="mt-4 font-rg-serif text-4xl leading-tight md:text-5xl">
              The wrong intervention can make the manuscript worse.
            </h2>
            <p className="mt-5 text-lg leading-8 text-rg-ink/75">
              Reliability means refusing to treat every weakness as a line-editing problem. The product should help the author see whether the manuscript needs architecture, pressure, continuity, scene work, voice protection, or polish.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {editorScopeProblems.map((item) => (
              <article key={item.problem} className="border border-rg-ink/15 bg-white/50 p-5">
                <h3 className="font-rg-serif text-2xl text-rg-ink">{item.problem}</h3>
                <p className="mt-4 leading-7 text-rg-ink/75">{item.response}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHeading
          eyebrow="May / must-not contract"
          title="RevisionGrade can recommend. It must not seize the pen."
          copy="This contract keeps the system useful without turning it into an ungoverned rewrite engine."
        />
        <div className="grid gap-4 md:grid-cols-2">
          <article className="border border-rg-gold/35 bg-rg-ink2/60 p-6">
            <h3 className="font-rg-serif text-3xl text-rg-cream">The system may</h3>
            <div className="mt-5 space-y-3">
              {mayDo.map((item) => (
                <p key={item} className="border border-rg-cream2/10 bg-rg-ink/60 p-3 text-sm leading-7 text-rg-cream2/80">{item}</p>
              ))}
            </div>
          </article>
          <article className="border border-rg-cream2/12 bg-rg-ink2/60 p-6">
            <h3 className="font-rg-serif text-3xl text-rg-cream">The system must not</h3>
            <div className="mt-5 space-y-3">
              {mustNotDo.map((item) => (
                <p key={item} className="border border-rg-cream2/10 bg-rg-ink/60 p-3 text-sm leading-7 text-rg-cream2/80">{item}</p>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <SectionHeading
            eyebrow="Reliability sequence"
            title="Diagnosis, constraint, decision."
            copy="The author should always understand what the system found, why it matters, what kind of repair is being proposed, and who controls the final change."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {workflow.map((item, index) => (
              <article key={item.step} className="border border-rg-cream2/12 bg-rg-ink/70 p-5">
                <p className="font-rg-mono text-xs text-rg-gold">0{index + 1}</p>
                <h3 className="mt-3 font-rg-serif text-2xl text-rg-cream">{item.step}</h3>
                <p className="mt-4 text-sm leading-7 text-rg-cream2/75">{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHeading
          eyebrow="Boundaries"
          title="What RevisionGrade will not pretend to know."
          copy="The safest product promise is a narrow, truthful one: manuscript diagnosis and governed repair support, not guaranteed publishing outcomes."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {limits.map((item) => (
            <div key={item} className="border border-rg-cream2/12 bg-rg-ink2/60 p-5 leading-7 text-rg-cream2/80">{item}</div>
          ))}
        </div>
      </section>

      <section className="bg-rg-cream text-rg-ink">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="border border-rg-ink/15 bg-white/50 p-8 md:p-10">
            <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Connection</p>
            <h2 className="mt-4 max-w-4xl font-rg-serif text-4xl leading-tight md:text-5xl">
              Reliability connects the Black Box Problem to Methodology and Revise.
            </h2>
            <p className="mt-5 max-w-3xl leading-8 text-rg-ink/75">
              The Black Box Problem explains why writers need diagnosis. Methodology explains how the system reads. Reliability explains why the author remains protected. Revise turns findings into controlled repair decisions instead of blind rewriting.
            </p>
            <div className="mt-7 flex flex-wrap gap-4 font-rg-mono text-xs uppercase tracking-[0.18em]">
              <Link href="/black-box-problem" className="text-rg-gold hover:text-rg-ink">Read Black Box →</Link>
              <Link href="/methodology" className="text-rg-gold hover:text-rg-ink">Read Methodology →</Link>
              <Link href="/privacy-research-controls" className="text-rg-gold hover:text-rg-ink">Privacy Controls →</Link>
              <Link href="/security" className="text-rg-gold hover:text-rg-ink">Security →</Link>
              <Link href="/revise" className="text-rg-gold hover:text-rg-ink">See Revise →</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
