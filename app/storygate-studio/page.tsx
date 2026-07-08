/**
 * /storygate-studio — Storygate Studio™ public landing page
 *
 * Design register: invitation-only prestige surface.
 * Cinematic, ceremonial, gold-foil elevation.
 * Darker than main RevisionGrade. Slower rhythm. More generous spacing.
 * Gold as foil: borders, dividers, seals, small caps, CTA fills on dark.
 * No SaaS blue anywhere.
 *
 * Current public scope: manuscript-first, publishing-facing controlled access.
 */

import Link from "next/link";
import StorygateReadinessBridge from "@/components/storygate/StorygateReadinessBridge";

const C = {
  bg:         "#090909",       // deeper black — more cinematic than main site
  bg2:        "#0F0F0F",       // panel surface
  bg3:        "#141414",       // card surface
  text:       "#F0EBE3",       // warm white
  textMuted:  "#C4B8A8",       // ash — body copy
  textDim:    "#8A7E72",       // dim — captions, fine print
  gold:       "#BFA255",       // richer, brighter foil gold (up from #A98E4A)
  goldDim:    "#7A6535",       // dark gold for subtle borders
  goldFoil:   "rgba(191,162,85,0.12)", // foil wash for panel backgrounds
  oxblood:    "#7A1E1E",       // secondary CTA (sign-in action)
  borderGold: "rgba(191,162,85,0.22)",
  borderAsh:  "rgba(196,184,168,0.18)",
  divider:    "rgba(191,162,85,0.30)",
} as const;

// ─── Typography helpers ────────────────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-mono text-[10px] uppercase tracking-[0.32em] mb-5"
      style={{ color: C.gold, letterSpacing: "0.32em" }}
    >
      {children}
    </p>
  );
}

function GoldRule() {
  return (
    <div
      style={{
        height: 1,
        background: `linear-gradient(90deg, transparent 0%, ${C.divider} 20%, ${C.gold} 50%, ${C.divider} 80%, transparent 100%)`,
      }}
      className="my-16 md:my-20 w-full max-w-5xl mx-auto"
    />
  );
}

// Thin top + bottom foil lines — used for the hero seal strip
function FoilStrip() {
  return (
    <div className="w-full max-w-xs mx-auto flex items-center gap-3 mb-10">
      <div className="flex-1" style={{ height: 1, backgroundColor: C.borderGold }} />
      <div
        className="font-mono text-[9px] uppercase tracking-[0.35em] px-3"
        style={{ color: C.goldDim }}
      >
        By Invitation
      </div>
      <div className="flex-1" style={{ height: 1, backgroundColor: C.borderGold }} />
    </div>
  );
}

// ─── CTA Button ───────────────────────────────────────────────────────────────

function CTAButton({
  href,
  children,
  variant = "gold",
  wide = false,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "gold" | "oxblood" | "ghost";
  wide?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    gold: {
      backgroundColor: C.gold,
      color: C.bg,
      border: `1px solid ${C.gold}`,
      fontWeight: 600,
    },
    oxblood: {
      backgroundColor: C.oxblood,
      color: C.text,
      border: `1px solid ${C.oxblood}`,
    },
    ghost: {
      backgroundColor: "transparent",
      color: C.gold,
      border: `1px solid ${C.borderGold}`,
    },
  };

  return (
    <Link
      href={href}
      className={`inline-block px-7 py-3.5 text-xs tracking-[0.20em] uppercase font-mono transition-opacity duration-150 hover:opacity-75${wide ? " w-full text-center" : ""}`}
      style={styles[variant]}
    >
      {children}
    </Link>
  );
}

// ─── Section label (gold small-caps strip) ────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-mono text-[10px] uppercase tracking-[0.28em] mb-6"
      style={{ color: C.gold }}
    >
      {children}
    </p>
  );
}

// ─── Foil card ────────────────────────────────────────────────────────────────

function FoilCard({
  title,
  body,
  footnote,
}: {
  title: string;
  body: string;
  footnote?: string;
}) {
  return (
    <div
      className="p-8"
      style={{
        backgroundColor: C.bg3,
        border: `1px solid ${C.borderGold}`,
        backgroundImage: `linear-gradient(135deg, ${C.goldFoil} 0%, transparent 60%)`,
      }}
    >
      <p
        className="font-mono text-[10px] uppercase tracking-[0.26em] mb-4"
        style={{ color: C.gold }}
      >
        {title}
      </p>
      <p className="text-base leading-[1.8]" style={{ color: C.textMuted }}>
        {body}
      </p>
      {footnote && (
        <p className="mt-4 text-xs leading-relaxed" style={{ color: C.textDim }}>
          {footnote}
        </p>
      )}
    </div>
  );
}

// ─── Gate card ────────────────────────────────────────────────────────────────

function GateCard({
  gate,
  title,
  body,
  items,
  footnote,
}: {
  gate: string;
  title: string;
  body: string;
  items: string[];
  footnote: string;
}) {
  return (
    <div className="p-8 md:p-10" style={{ border: `1px solid ${C.borderGold}` }}>
      <p
        className="font-mono text-[10px] uppercase tracking-[0.30em] mb-1"
        style={{ color: C.gold }}
      >
        {gate}
      </p>
      <p
        className="text-xl font-semibold mb-5 leading-snug"
        style={{ fontFamily: "Playfair Display, Georgia, serif", color: C.text }}
      >
        {title}
      </p>
      <p className="text-sm leading-[1.8] mb-6" style={{ color: C.textMuted }}>
        {body}
      </p>
      <ul className="space-y-3 mb-7">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm" style={{ color: C.textMuted }}>
            <span style={{ color: C.gold, flexShrink: 0, marginTop: 3 }}>—</span>
            <span className="leading-[1.75]">{item}</span>
          </li>
        ))}
      </ul>
      <p
        className="text-sm leading-[1.8] p-4"
        style={{
          color: C.textMuted,
          border: `1px solid ${C.borderGold}`,
          backgroundColor: C.bg2,
        }}
      >
        {footnote}
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StorygateStudioLanding() {
  return (
    <main
      style={{ backgroundColor: C.bg, color: C.text, fontFamily: "Inter, system-ui, sans-serif" }}
      className="storygate-studio-route min-h-screen"
    >

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section
        className="pt-24 pb-20 px-6 text-center"
        style={{ borderBottom: `1px solid ${C.borderAsh}` }}
      >
        <FoilStrip />
        <Eyebrow>Storygate Studio™ · Controlled Access</Eyebrow>
        <h1
          className="text-5xl md:text-7xl font-bold mb-8 max-w-4xl mx-auto"
          style={{
            fontFamily: "Playfair Display, Georgia, serif",
            color: C.text,
            lineHeight: 1.08,
            letterSpacing: "-0.01em",
          }}
        >
          A curated gateway for readiness-vetted manuscript projects.
        </h1>
        <p
          className="text-lg md:text-xl max-w-3xl mx-auto mb-4 leading-[1.85]"
          style={{ color: C.textMuted }}
        >
          Storygate Studio gives verified publishing professionals controlled access to
          creator-approved manuscript projects. Materials are not publicly searchable.
          Access is requested, approved, and logged.
        </p>
        <p
          className="text-sm mb-12 tracking-[0.10em] uppercase font-mono"
          style={{ color: C.textDim }}
        >
          Verified access only · Creator-approved visibility · Logged project activity
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <CTAButton href="/storygate-studio/apply" variant="gold">
            Prepare a Project for Storygate
          </CTAButton>
          <CTAButton href="/storygate-studio/industry" variant="ghost">
            Request Publishing Access
          </CTAButton>
          <CTAButton href="/storygate-studio/industry" variant="oxblood">
            Sign In as Industry User
          </CTAButton>
        </div>
      </section>

      {/* ── READINESS BRIDGE ─────────────────────────────────────────────── */}
      <StorygateReadinessBridge />

      <GoldRule />

      {/* ── TRUST MODEL ──────────────────────────────────────────────────── */}
      <section className="py-0 pb-20 px-6 max-w-7xl mx-auto">
        <SectionLabel>Trust Model</SectionLabel>
        <h2
          className="text-4xl md:text-5xl font-bold mb-6 max-w-3xl"
          style={{ fontFamily: "Playfair Display, Georgia, serif", lineHeight: 1.12 }}
        >
          Built for controlled discovery, not open browsing.
        </h2>
        <p className="text-lg mb-14 max-w-3xl leading-[1.85]" style={{ color: C.textMuted }}>
          Storygate Studio is designed for serious authors and legitimate publishing
          professionals. Projects are not publicly searchable. Access is granted by
          request, by role, and by creator approval.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <FoilCard
            title="Verified Access Only"
            body="Publishing professionals must be approved before viewing project materials. No browsing, no open directories. Every access path begins with verification."
          />
          <FoilCard
            title="Creator Approval"
            body="Industry users request access to specific manuscript projects. Creators approve or decline on a per-project basis. You remain in control of what is seen and by whom."
          />
          <FoilCard
            title="Creator-Controlled Visibility"
            body="Creators decide which manuscript materials are visible to which viewers and roles. Visibility is not granted by default — it is set explicitly by the creator for each project."
          />
          <FoilCard
            title="Logged Activity"
            body="Project access and key viewer activity are recorded to support accountability and creator confidence. The activity log is append-only."
          />
        </div>
      </section>

      <GoldRule />

      {/* ── MATERIALS ────────────────────────────────────────────────────── */}
      <section className="py-0 pb-20 px-6 max-w-7xl mx-auto">
        <SectionLabel>Materials</SectionLabel>
        <h2
          className="text-4xl md:text-5xl font-bold mb-6 max-w-3xl"
          style={{ fontFamily: "Playfair Display, Georgia, serif", lineHeight: 1.12 }}
        >
          A clean professional package, not a cluttered submission dump.
        </h2>
        <p className="text-lg mb-10 max-w-3xl leading-[1.85]" style={{ color: C.textMuted }}>
          Depending on creator permissions, verified publishing professionals may view:
        </p>
        <ul className="space-y-4 mb-10 max-w-2xl">
          {[
            "Query hook and short manuscript pitch",
            "Synopsis or book-project overview",
            "Author bio and project metadata",
            "Sample pages or full manuscript materials selected by the creator",
            "Optional evaluation summary or professional readiness assessment",
            "Optional comparables and manuscript positioning notes",
          ].map((item) => (
            <li key={item} className="flex items-start gap-4 text-base" style={{ color: C.text }}>
              <span style={{ color: C.gold, flexShrink: 0, marginTop: 4, fontSize: "18px", lineHeight: 1 }}>—</span>
              <span className="leading-[1.8]">{item}</span>
            </li>
          ))}
        </ul>
        <p className="text-base italic leading-[1.85] max-w-2xl" style={{ color: C.textMuted }}>
          Storygate Studio gives professionals enough to assess interest without forcing
          creators to expose everything by default.
        </p>
      </section>

      <GoldRule />

      {/* ── WHO IT'S FOR ─────────────────────────────────────────────────── */}
      <section className="py-0 pb-20 px-6 max-w-7xl mx-auto">
        <SectionLabel>Who It&apos;s For</SectionLabel>
        <h2
          className="text-4xl md:text-5xl font-bold mb-14"
          style={{ fontFamily: "Playfair Display, Georgia, serif", lineHeight: 1.12 }}
        >
          For publishing professionals and manuscript creators.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            className="p-10"
            style={{
              backgroundColor: C.bg3,
              border: `1px solid ${C.borderGold}`,
              backgroundImage: `linear-gradient(135deg, ${C.goldFoil} 0%, transparent 55%)`,
            }}
          >
            <SectionLabel>Publishing Professionals</SectionLabel>
            <p className="text-base leading-[1.85] mb-8" style={{ color: C.textMuted }}>
              Discover readiness-vetted manuscript projects through a secure, request-based
              access layer. You can request access to projects that match your role,
              interests, and professional focus. Once approved, you see only the materials
              the creator has chosen to share.
            </p>
            <CTAButton href="/storygate-studio/industry" variant="gold">
              Request Publishing Access
            </CTAButton>
          </div>
          <div
            className="p-10"
            style={{ border: `1px solid ${C.borderAsh}` }}
          >
            <SectionLabel>Authors and Creators</SectionLabel>
            <p className="text-base leading-[1.85] mb-8" style={{ color: C.textMuted }}>
              Prepare your manuscript project for professional consideration without losing
              control of access. Storygate Studio is for projects that have cleared a
              professional presentation and readiness threshold. Once eligible, your project
              can be placed into a controlled environment where verified publishing
              professionals may request review.
            </p>
            <CTAButton href="/storygate-studio/apply" variant="ghost">
              Learn How to Qualify
            </CTAButton>
          </div>
        </div>
      </section>

      <GoldRule />

      {/* ── ELIGIBILITY ──────────────────────────────────────────────────── */}
      <section className="py-0 pb-20 px-6 max-w-7xl mx-auto">
        <SectionLabel>Eligibility</SectionLabel>
        <h2
          className="text-4xl md:text-5xl font-bold mb-5"
          style={{ fontFamily: "Playfair Display, Georgia, serif", lineHeight: 1.12 }}
        >
          Storygate placement requires two gates.
        </h2>
        <p className="text-lg mb-14 max-w-3xl leading-[1.85]" style={{ color: C.textMuted }}>
          Storygate Studio is selective. Manuscript projects must satisfy both requirements
          before placement.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GateCard
            gate="Gate 1"
            title="Professional Manuscript Package"
            body="Creators must provide a clear, professionally formatted package that communicates the manuscript quickly and credibly. This may include:"
            items={[
              "Query letter with a clear hook paragraph",
              "Synopsis or book-project overview",
              "Author bio",
              "Sample pages or manuscript materials",
              "Supporting materials — comparables, audience positioning, or optional readiness assessment",
            ]}
            footnote="A RevisionGrade-generated package may satisfy this requirement, but creators may also use equivalent professional materials created independently or through another service. There is no requirement to purchase RevisionGrade services to qualify."
          />
          <GateCard
            gate="Gate 2"
            title="Minimum Readiness / Quality Threshold"
            body="Manuscript projects must demonstrate a minimum professional standard through one of the following:"
            items={[
              "A RevisionGrade score of 9.0 or higher from a full manuscript evaluation, or",
              "An equivalent professional manuscript assessment from a qualified third party — such as a literary agent, acquiring editor, professional editor, or recognized publishing evaluator",
            ]}
            footnote="Storygate Studio is not designed to replace professional judgment. It is designed to make professionally prepared manuscript projects easier to review, route, and protect."
          />
        </div>
      </section>

      <GoldRule />

      {/* ── WHY IT EXISTS ────────────────────────────────────────────────── */}
      <section className="py-0 pb-20 px-6 max-w-7xl mx-auto">
        <SectionLabel>Why It Exists</SectionLabel>
        <h2
          className="text-4xl md:text-5xl font-bold mb-8 max-w-4xl"
          style={{ fontFamily: "Playfair Display, Georgia, serif", lineHeight: 1.12 }}
        >
          Good manuscript projects should not disappear into the black box.
        </h2>
        <p className="text-lg mb-6 max-w-3xl leading-[1.85]" style={{ color: C.textMuted }}>
          Authors often face the same problem: silence, generic rejection, or no clear
          signal about whether the issue is manuscript readiness, market fit, timing,
          or access.
        </p>
        <p className="text-lg mb-10 max-w-3xl leading-[1.85]" style={{ color: C.textMuted }}>
          Storygate Studio does not promise representation, publication, or commercial
          outcome. It creates a more disciplined bridge between prepared creators and
          verified publishing professionals:
        </p>
        <ul className="space-y-4 mb-12 max-w-xl">
          {[
            "Creators keep control of their materials.",
            "Professionals see organized, readiness-vetted packages.",
            "Access is requested, approved, and logged.",
            "Projects are presented through a standard designed for serious review.",
          ].map((item) => (
            <li key={item} className="flex items-start gap-4 text-base" style={{ color: C.text }}>
              <span style={{ color: C.gold, flexShrink: 0, marginTop: 4, fontSize: "18px", lineHeight: 1 }}>—</span>
              <span className="leading-[1.8]">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <GoldRule />

      {/* ── CURRENT SCOPE ────────────────────────────────────────────────── */}
      <section className="py-0 pb-20 px-6 max-w-7xl mx-auto">
        <SectionLabel>Current Scope</SectionLabel>
        <h2
          className="text-4xl md:text-5xl font-bold mb-14"
          style={{ fontFamily: "Playfair Display, Georgia, serif", lineHeight: 1.12 }}
        >
          Built for manuscript-first publishing pathways.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              type: "Novels",
              desc: "For long-form fiction projects prepared for literary-agent or publishing review.",
              materials:
                "Query letter, synopsis, author bio, sample pages, comparables, and optional evaluation summary.",
            },
            {
              type: "Memoir · Serious Nonfiction",
              desc: "For supported prose projects where author platform, subject relevance, and clear positioning matter.",
              materials:
                "Query package, synopsis or proposal-style summary where appropriate, author bio, and positioning notes.",
            },
            {
              type: "Complex Manuscripts",
              desc: "For multi-POV, multi-timeline, genre-hybrid, or unusually structured manuscript projects.",
              materials:
                "Professional manuscript package plus readiness evidence sufficient for controlled publishing review.",
            },
          ].map(({ type, desc, materials }) => (
            <div
              key={type}
              className="p-8"
              style={{ backgroundColor: C.bg3, border: `1px solid ${C.borderAsh}` }}
            >
              <p
                className="font-mono text-[10px] uppercase tracking-[0.24em] mb-5"
                style={{ color: C.gold }}
              >
                {type}
              </p>
              <p className="text-base mb-4 leading-[1.8]" style={{ color: C.text }}>
                {desc}
              </p>
              <p className="text-sm leading-[1.8]" style={{ color: C.textMuted }}>
                {materials}
              </p>
            </div>
          ))}
        </div>
      </section>

      <GoldRule />

      {/* ── SCOPE (not a guarantee) ──────────────────────────────────────── */}
      <section className="py-0 pb-20 px-6 max-w-7xl mx-auto">
        <SectionLabel>Scope</SectionLabel>
        <h2
          className="text-4xl md:text-5xl font-bold mb-5"
          style={{ fontFamily: "Playfair Display, Georgia, serif", lineHeight: 1.12 }}
        >
          A professional gateway, not a guarantee.
        </h2>
        <p className="text-lg mb-10" style={{ color: C.textMuted }}>
          Storygate Studio is not:
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-10">
          {[
            "A literary agency",
            "A publisher",
            "A contest",
            "A public marketplace",
            "A substitute for professional judgment",
            "A guarantee of representation, publication, sale, or placement",
          ].map((item) => (
            <div
              key={item}
              className="px-5 py-4 text-sm leading-[1.7]"
              style={{
                backgroundColor: C.bg2,
                border: `1px solid ${C.borderAsh}`,
                color: C.textMuted,
              }}
            >
              {item}
            </div>
          ))}
        </div>
        <p className="text-base italic max-w-3xl leading-[1.85]" style={{ color: C.textMuted }}>
          Storygate Studio is a selective access layer for professionally prepared manuscript
          projects. Industry response remains subjective and market-dependent.
        </p>
      </section>

      <GoldRule />

      {/* ── ENTER THE RIGHT DOOR (CTA panel) ─────────────────────────────── */}
      <section
        className="py-20 px-6 text-center"
        style={{
          backgroundColor: C.bg2,
          borderTop: `1px solid ${C.borderGold}`,
          borderBottom: `1px solid ${C.borderGold}`,
        }}
      >
        <SectionLabel>Enter the Right Door</SectionLabel>
        <h2
          className="text-4xl md:text-5xl font-bold mb-16"
          style={{ fontFamily: "Playfair Display, Georgia, serif", lineHeight: 1.12 }}
        >
          Ready to proceed?
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 max-w-5xl mx-auto text-left">
          <div>
            <p
              className="font-mono text-[10px] uppercase tracking-[0.28em] mb-3"
              style={{ color: C.gold }}
            >
              Publishing Professionals
            </p>
            <p className="text-base mb-8 leading-[1.85]" style={{ color: C.textMuted }}>
              Request verified access to review selected manuscript projects.
            </p>
            <CTAButton href="/storygate-studio/industry" variant="gold">
              Request Publishing Access
            </CTAButton>
          </div>
          <div>
            <p
              className="font-mono text-[10px] uppercase tracking-[0.28em] mb-3"
              style={{ color: C.gold }}
            >
              Authors and Creators
            </p>
            <p className="text-base mb-8 leading-[1.85]" style={{ color: C.textMuted }}>
              Prepare your manuscript project for eligibility and controlled publishing review.
            </p>
            <CTAButton href="/storygate-studio/apply" variant="ghost">
              Prepare a Project for Storygate
            </CTAButton>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 max-w-4xl mx-auto">
        <SectionLabel>FAQ</SectionLabel>
        <h2
          className="text-4xl md:text-5xl font-bold mb-14"
          style={{ fontFamily: "Playfair Display, Georgia, serif", lineHeight: 1.12 }}
        >
          Questions before you apply?
        </h2>
        <div className="space-y-10">
          {[
            {
              q: "Do I need to use RevisionGrade to qualify?",
              a: "No. A RevisionGrade package may satisfy eligibility requirements, but creators may also qualify with equivalent professional materials created independently or through another service.",
            },
            {
              q: "Does Storygate guarantee representation or publication?",
              a: "No. Storygate Studio does not guarantee representation, publication, sale, placement, or any specific market response.",
            },
            {
              q: "Do I need to keep paying to remain in Storygate Studio?",
              a: "No. Once a project has been submitted into Storygate Studio, remaining eligible for consideration does not require an active paid subscription. Paid tools may be required later only if you want to revise, update, or resubmit materials.",
            },
            {
              q: "What materials are required for manuscript submissions?",
              a: "Manuscript projects typically require a professional query letter, synopsis, and author bio. The pitch or hook belongs inside the query letter, not as a redundant separate document.",
            },
            {
              q: "What kinds of projects are currently supported?",
              a: "Storygate Studio currently supports manuscript-first publishing pathways: novels, supported memoir or serious nonfiction projects, and complex long-form prose manuscripts. Other media pathways are future scope and are not part of the current public service.",
            },
          ].map(({ q, a }) => (
            <div
              key={q}
              className="pb-10"
              style={{ borderBottom: `1px solid ${C.borderAsh}` }}
            >
              <p
                className="text-xl font-semibold mb-4 leading-snug"
                style={{ fontFamily: "Playfair Display, Georgia, serif", color: C.text }}
              >
                {q}
              </p>
              <p className="text-base leading-[1.85]" style={{ color: C.textMuted }}>
                {a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer
        className="py-12 px-6 text-center"
        style={{ borderTop: `1px solid ${C.borderAsh}` }}
      >
        <div className="w-20 h-px mx-auto mb-8" style={{ backgroundColor: C.borderGold }} />
        <p
          className="text-base max-w-3xl mx-auto leading-[1.85]"
          style={{ color: C.textMuted }}
        >
          Storygate Studio™ is part of the RevisionGrade™ ecosystem. It is designed to
          support professional manuscript readiness, controlled access, and accountable
          review pathways for serious book projects.
        </p>
        <p className="text-sm mt-5 font-mono tracking-[0.08em]" style={{ color: C.textDim }}>
          All project views, access requests, notes, and packet activity are logged and
          append-only. Materials may not be copied, shared, or distributed outside this
          verified account.
        </p>
        <div className="w-20 h-px mx-auto mt-8" style={{ backgroundColor: C.borderGold }} />
      </footer>
    </main>
  );
}
