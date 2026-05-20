/**
 * RevisionGrade — Marketing Homepage
 *
 * Route: /
 * Design language: ritual-luxury (rg-ink, rg-cream, rg-gold, rg-red)
 * Sections: Hero · The Standard · The Instrument · The Five Readings · Doctrine · CTA
 */
import Link from "next/link";

export const metadata = {
  title: "RevisionGrade™ — Governed Revision for Serious Manuscripts",
  description:
    "A governed revision operating system built on 13 story evaluation criteria. Evaluate your manuscript. Understand exactly where it stands.",
};

export default function HomePage() {
  return (
    <div className="bg-rg-ink text-rg-cream min-h-screen font-rg-serif">

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-20">

        {/* Eyebrow */}
        <p className="font-rg-mono text-xs tracking-[0.22em] uppercase text-rg-cream2 mb-10">
          <span className="text-rg-red mr-2">●</span>
          A governed revision operating system
        </p>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl leading-[1.03] tracking-tight mb-6 max-w-3xl">
          Your manuscript{" "}
          <em className="italic text-rg-gold" style={{ textDecorationLine: "underline", textDecorationColor: "#7A2B1A", textUnderlineOffset: "8px" }}>
            evaluated
          </em>
          {" "}with the rigor of a senior developmental editor.
        </h1>

        <p className="text-rg-cream2 text-lg leading-relaxed max-w-xl mb-12">
          RevisionGrade applies a 13-criterion story framework to your full manuscript —
          surfacing craft issues, measuring readiness, and sequencing repair in a governed queue.
          Framework-driven analysis. Not a replacement for human editorial judgment.
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/evaluate"
            className="inline-block border border-rg-gold text-rg-gold font-rg-mono text-xs tracking-widest uppercase px-8 py-4 hover:bg-rg-gold hover:text-rg-ink transition-colors duration-200"
          >
            Begin Evaluation
          </Link>
          <Link
            href="/pricing"
            className="inline-block border border-rg-cream2/30 text-rg-cream2 font-rg-mono text-xs tracking-widest uppercase px-8 py-4 hover:border-rg-cream2 hover:text-rg-cream transition-colors duration-200"
          >
            View Pricing
          </Link>
        </div>

        {/* Doctrine pull-quote */}
        <div className="mt-20 border-l-2 border-rg-red pl-6 max-w-xl">
          <p className="text-rg-cream2 text-sm leading-relaxed italic">
            "A manuscript at 8.0 or higher is considered curation-ready within the RevisionGrade
            framework. Crossing that threshold marks the moment serious work becomes submittable work."
          </p>
        </div>

      </section>

      {/* ── THE STANDARD ──────────────────────────────────────────────────── */}
      <section className="border-t border-rg-cream2/10 bg-rg-ink2">
        <div className="max-w-5xl mx-auto px-6 py-20">

          <p className="font-rg-mono text-xs tracking-[0.22em] uppercase text-rg-gold mb-6">
            The Standard
          </p>

          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div>
              <h2 className="text-4xl lg:text-5xl leading-tight mb-6">
                What does a senior editor actually read for?
              </h2>
              <p className="text-rg-cream2 leading-relaxed mb-4">
                Most writing tools flag commas and passive voice. RevisionGrade reads the way
                a developmental editor reads — for structure, causality, character pressure,
                pacing, and the 10 other signals that separate publishable work from a strong draft.
              </p>
              <p className="text-rg-cream2 leading-relaxed">
                The WAVE Revision System distills that editorial standard into a deterministic,
                repeatable framework. The same 13 criteria. Every manuscript. Every pass.
              </p>
            </div>

            <div className="space-y-px">
              {[
                ["Spine & Causality", "Does each scene drive the next with clear cause?"],
                ["Character Pressure", "Are characters tested, not just active?"],
                ["Structural Pacing", "Does tension arc and release at the right intervals?"],
                ["Voice Integrity", "Is the narrator's voice stable and purposeful?"],
                ["Thematic Coherence", "Does the story mean something, consistently?"],
                ["Scene Economy", "Is every scene earning its place?"],
                ["Dialogue Authenticity", "Does speech reveal character under pressure?"],
                ["World Consistency", "Does the setting behave by its own rules?"],
                ["Emotional Resonance", "Do readers feel what the story asks them to feel?"],
                ["Market Readiness", "Is this manuscript submittable by industry standards?"],
              ].map(([criterion, desc]) => (
                <div key={criterion} className="flex gap-4 py-3 border-b border-rg-cream2/8">
                  <span className="text-rg-gold text-xs font-rg-mono mt-1 shrink-0">→</span>
                  <div>
                    <p className="text-rg-cream text-sm font-rg-mono tracking-wide uppercase">{criterion}</p>
                    <p className="text-rg-cream2 text-xs mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* ── THE INSTRUMENT ────────────────────────────────────────────────── */}
      <section className="border-t border-rg-cream2/10">
        <div className="max-w-5xl mx-auto px-6 py-20">

          <p className="font-rg-mono text-xs tracking-[0.22em] uppercase text-rg-gold mb-6">
            The Instrument
          </p>

          <h2 className="text-4xl lg:text-5xl leading-tight mb-6 max-w-2xl">
            Measure whether revision is producing real gains.
          </h2>

          <p className="text-rg-cream2 leading-relaxed max-w-2xl mb-16">
            Your dashboard tracks every evaluation — scores, trend lines, recurring errors, and
            readiness progress over time. Not a one-time report. A longitudinal instrument for
            writers in active revision.
          </p>

          {/* Score threshold callout */}
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { label: "Below Standard", range: "Below 6.5", desc: "Foundational craft issues present. Structural repair recommended before revision work begins.", color: "border-rg-red/40" },
              { label: "Improving", range: "6.5 – 7.9", desc: "Craft is developing. Revision is producing measurable gains across evaluation cycles.", color: "border-rg-cream2/20" },
              { label: "Curation Ready", range: "8.0 and above", desc: "Manuscript meets the RevisionGrade threshold for agent-facing readiness and Storygate curation eligibility.", color: "border-rg-gold/50" },
            ].map(({ label, range, desc, color }) => (
              <div key={label} className={`border ${color} bg-rg-ink2 p-6`}>
                <p className="font-rg-mono text-xs tracking-widest uppercase text-rg-gold mb-2">{label}</p>
                <p className="text-3xl font-rg-serif text-rg-cream mb-3">{range}</p>
                <p className="text-rg-cream2 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── THE FIVE READINGS ─────────────────────────────────────────────── */}
      <section className="border-t border-rg-cream2/10 bg-rg-ink2">
        <div className="max-w-5xl mx-auto px-6 py-20">

          <p className="font-rg-mono text-xs tracking-[0.22em] uppercase text-rg-gold mb-6">
            How It Works
          </p>

          <h2 className="text-4xl lg:text-5xl leading-tight mb-12 max-w-2xl">
            A five-pass reading of your manuscript.
          </h2>

          <div className="grid md:grid-cols-2 gap-x-16 gap-y-10">
            {[
              {
                pass: "Pass 1",
                name: "Structural Inventory",
                desc: "RevisionGrade reads your full manuscript for story architecture — spine, causality, act structure, and chapter-level anatomy — before evaluating a single sentence.",
              },
              {
                pass: "Pass 2",
                name: "Craft Signal Extraction",
                desc: "Each of the 13 criteria is scored independently, producing a granular view of where the manuscript is strong and where it is structurally vulnerable.",
              },
              {
                pass: "Pass 3",
                name: "WAVE Synthesis",
                desc: "The WAVE Revision System consolidates findings into a unified report, ranking issues by severity (MUST / SHOULD / COULD) and leverage (SPINE / HIGH / MEDIUM / LOW).",
              },
              {
                pass: "Pass 4",
                name: "Revision Queue",
                desc: "REVISE presents structured RevisionOpportunity items in a governed queue. Authors work chapter by chapter, or manuscript-wide, with dependency-aware blocking.",
              },
              {
                pass: "Pass 5",
                name: "Readiness Score",
                desc: "A composite score measures overall market readiness against the 8.0 threshold. Re-evaluate after revision to measure whether craft is genuinely improving.",
              },
            ].map(({ pass, name, desc }) => (
              <div key={pass} className="flex gap-5">
                <span className="font-rg-mono text-rg-gold text-xs tracking-widest uppercase pt-1 shrink-0 w-14">{pass}</span>
                <div>
                  <p className="text-rg-cream text-sm font-rg-mono tracking-wide uppercase mb-2">{name}</p>
                  <p className="text-rg-cream2 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── DOCTRINE ──────────────────────────────────────────────────────── */}
      <section className="border-t border-rg-cream2/10">
        <div className="max-w-5xl mx-auto px-6 py-20">

          <p className="font-rg-mono text-xs tracking-[0.22em] uppercase text-rg-gold mb-6">
            Our Doctrine
          </p>

          <blockquote className="text-3xl lg:text-4xl leading-relaxed max-w-3xl text-rg-cream2 italic mb-8">
            "Hard governance underneath. Rich editorial humanity on top."
          </blockquote>

          <p className="text-rg-cream2 leading-relaxed max-w-2xl text-sm mb-2">
            RevisionGrade is framework-driven analysis. It does not replace human editorial
            judgment, literary agents, or developmental editors. It gives serious authors a
            rigorous, repeatable instrument for understanding where their manuscript stands —
            and what to repair before it goes to a reader who matters.
          </p>

          <p className="text-rg-dim text-xs font-rg-mono tracking-wide mt-4">
            Powered by the WAVE Revision System · 13 Story Evaluation Criteria
          </p>

        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="border-t border-rg-cream2/10 bg-rg-ink2">
        <div className="max-w-5xl mx-auto px-6 py-24 text-center">

          <p className="font-rg-mono text-xs tracking-[0.22em] uppercase text-rg-cream2 mb-8">
            <span className="text-rg-red mr-2">●</span>
            Begin your first evaluation
          </p>

          <h2 className="text-5xl lg:text-6xl leading-tight mb-6">
            Know where your manuscript stands.
          </h2>

          <p className="text-rg-cream2 text-lg leading-relaxed max-w-lg mx-auto mb-12">
            Upload your manuscript. Get a governed, criterion-by-criterion evaluation.
            Understand exactly what stands between your draft and agent-facing readiness.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/evaluate"
              className="inline-block border border-rg-gold text-rg-gold font-rg-mono text-xs tracking-widest uppercase px-10 py-4 hover:bg-rg-gold hover:text-rg-ink transition-colors duration-200"
            >
              Begin Evaluation
            </Link>
            <Link
              href="/pricing"
              className="inline-block border border-rg-cream2/30 text-rg-cream2 font-rg-mono text-xs tracking-widest uppercase px-10 py-4 hover:border-rg-cream2 hover:text-rg-cream transition-colors duration-200"
            >
              See Plans & Pricing
            </Link>
          </div>

          <p className="mt-8 text-rg-dim text-xs font-rg-mono">
            Free sample evaluation available · No credit card required to begin
          </p>

        </div>
      </section>

    </div>
  );
}
