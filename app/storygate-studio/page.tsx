/**
 * /storygate-studio — Storygate Studio™ public landing page
 *
 * Current public scope: manuscript-first, publishing-facing controlled access.
 * Film/TV, screenplay, pitch deck, adaptation, producer, and development
 * workflows are intentionally excluded until those product paths exist.
 */

import Link from "next/link";

const C = {
  bg:       "#0E0E0E",
  text:     "#F2EFEA",
  oxblood:  "#7A1E1E",
  gold:     "#A98E4A",
  ash:      "#7B7B7B",
  panel:    "#161616",
  border:   "rgba(161,142,74,0.18)",
  borderAsh:"rgba(123,123,123,0.18)",
} as const;

function Divider() {
  return (
    <div
      style={{ height: 1, background: `linear-gradient(90deg, transparent, ${C.gold}44, transparent)` }}
      className="my-20 w-full max-w-3xl mx-auto"
    />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xs tracking-[0.22em] uppercase mb-4 font-mono"
      style={{ color: C.gold }}
    >
      {children}
    </p>
  );
}

function CTAButton({
  href,
  children,
  variant = "gold",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "gold" | "oxblood" | "ghost";
}) {
  const styles: Record<string, React.CSSProperties> = {
    gold: {
      backgroundColor: C.gold,
      color: C.bg,
      border: `1px solid ${C.gold}`,
    },
    oxblood: {
      backgroundColor: C.oxblood,
      color: C.text,
      border: `1px solid ${C.oxblood}`,
    },
    ghost: {
      backgroundColor: "transparent",
      color: C.gold,
      border: `1px solid ${C.gold}`,
    },
  };

  return (
    <Link
      href={href}
      className="inline-block px-6 py-3 text-xs tracking-[0.18em] uppercase font-mono transition-opacity duration-150 hover:opacity-80"
      style={styles[variant]}
    >
      {children}
    </Link>
  );
}

export default function StorygateStudioLanding() {
  return (
    <main
      style={{ backgroundColor: C.bg, color: C.text, fontFamily: "Inter, system-ui, sans-serif" }}
      className="min-h-screen"
    >
      <section
        className="pt-28 pb-24 px-6 text-center"
        style={{ borderBottom: `1px solid ${C.borderAsh}` }}
      >
        <SectionLabel>Storygate Studio™</SectionLabel>
        <h1
          className="text-4xl md:text-5xl font-bold mb-6 max-w-3xl mx-auto leading-tight"
          style={{ fontFamily: "Playfair Display, Georgia, serif", color: C.text }}
        >
          Controlled access for readiness-vetted manuscript projects.
        </h1>
        <p className="text-base max-w-2xl mx-auto mb-3" style={{ color: C.ash }}>
          Storygate Studio gives verified publishing professionals controlled access to creator-approved manuscript projects. Materials are not publicly searchable. Access is requested, approved, and logged.
        </p>
        <p className="text-xs mb-10 tracking-wide" style={{ color: C.ash }}>
          Verified access only. Creator-approved visibility. Logged project activity.
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

      <section className="py-24 px-6 max-w-5xl mx-auto">
        <SectionLabel>Trust Model</SectionLabel>
        <h2
          className="text-2xl md:text-3xl font-bold mb-12"
          style={{ fontFamily: "Playfair Display, Georgia, serif" }}
        >
          Built for controlled discovery, not open browsing.
        </h2>
        <p className="text-sm mb-12 max-w-2xl" style={{ color: C.ash }}>
          Storygate Studio is designed for serious authors and legitimate publishing professionals. Projects are not publicly searchable. Access is granted by request, by role, and by creator approval.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            ["Verified Access Only", "Publishing professionals must be approved before viewing project materials."],
            ["Creator Approval", "Industry users request access to specific manuscript projects. Creators approve or decline on a per-project basis."],
            ["Creator-Controlled Visibility", "Creators decide which manuscript materials are visible to which viewers and roles."],
            ["Logged Activity", "Project access and key viewer activity are recorded to support accountability and creator confidence."],
          ].map(([title, body]) => (
            <div
              key={title}
              className="p-6"
              style={{ backgroundColor: C.panel, border: `1px solid ${C.border}` }}
            >
              <p
                className="text-xs tracking-[0.16em] uppercase mb-3 font-mono"
                style={{ color: C.gold }}
              >
                {title}
              </p>
              <p className="text-sm leading-relaxed" style={{ color: C.ash }}>
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <Divider />

      <section className="py-0 pb-24 px-6 max-w-5xl mx-auto">
        <SectionLabel>Materials</SectionLabel>
        <h2
          className="text-2xl md:text-3xl font-bold mb-6"
          style={{ fontFamily: "Playfair Display, Georgia, serif" }}
        >
          A clean professional manuscript package, not a cluttered submission dump.
        </h2>
        <p className="text-sm mb-10 max-w-2xl" style={{ color: C.ash }}>
          Depending on creator permissions, verified publishing professionals may view:
        </p>
        <ul className="space-y-3 mb-8">
          {[
            "Query hook and short manuscript pitch",
            "Synopsis or book-project overview",
            "Author bio and project metadata",
            "Sample pages or full manuscript materials selected by the creator",
            "Optional evaluation summary or professional readiness assessment",
            "Optional comparables and manuscript positioning notes",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm" style={{ color: C.text }}>
              <span style={{ color: C.gold, flexShrink: 0, marginTop: 2 }}>—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs italic" style={{ color: C.ash }}>
          Storygate Studio gives professionals enough to assess interest without forcing creators to expose everything by default.
        </p>
      </section>

      <Divider />

      <section className="py-0 pb-24 px-6 max-w-5xl mx-auto">
        <SectionLabel>Who It&apos;s For</SectionLabel>
        <h2
          className="text-2xl md:text-3xl font-bold mb-12"
          style={{ fontFamily: "Playfair Display, Georgia, serif" }}
        >
          For publishing professionals and manuscript creators.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div
            className="p-8"
            style={{ backgroundColor: C.panel, border: `1px solid ${C.border}` }}
          >
            <p className="text-xs tracking-[0.16em] uppercase mb-4 font-mono" style={{ color: C.gold }}>
              Publishing Professionals
            </p>
            <p className="text-sm leading-relaxed mb-8" style={{ color: C.ash }}>
              Discover readiness-vetted manuscript projects through a secure, request-based access layer. You can request access to projects that match your role, interests, and professional focus. Once approved, you see only the materials the creator has chosen to share.
            </p>
            <CTAButton href="/storygate-studio/industry" variant="gold">
              Request Publishing Access
            </CTAButton>
          </div>

          <div
            className="p-8"
            style={{ backgroundColor: C.panel, border: `1px solid ${C.borderAsh}` }}
          >
            <p className="text-xs tracking-[0.16em] uppercase mb-4 font-mono" style={{ color: C.gold }}>
              Authors and Creators
            </p>
            <p className="text-sm leading-relaxed mb-8" style={{ color: C.ash }}>
              Prepare your manuscript project for professional consideration without losing control of access. Storygate Studio is for projects that have cleared a professional presentation and readiness threshold. Once eligible, your project can be placed into a controlled access environment where verified publishing professionals may request review.
            </p>
            <CTAButton href="/storygate-studio/apply" variant="ghost">
              Learn How to Qualify
            </CTAButton>
          </div>
        </div>
      </section>

      <Divider />

      <section className="py-0 pb-24 px-6 max-w-5xl mx-auto">
        <SectionLabel>Eligibility</SectionLabel>
        <h2
          className="text-2xl md:text-3xl font-bold mb-4"
          style={{ fontFamily: "Playfair Display, Georgia, serif" }}
        >
          Storygate placement requires two gates.
        </h2>
        <p className="text-sm mb-12 max-w-2xl" style={{ color: C.ash }}>
          Storygate Studio is selective. Manuscript projects must satisfy both requirements before placement.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div
            className="p-8"
            style={{ border: `1px solid ${C.border}` }}
          >
            <p className="text-xs tracking-[0.18em] uppercase mb-1 font-mono" style={{ color: C.gold }}>
              Gate 1
            </p>
            <p
              className="text-lg font-bold mb-4"
              style={{ fontFamily: "Playfair Display, Georgia, serif" }}
            >
              Professional Manuscript Package
            </p>
            <p className="text-sm mb-5" style={{ color: C.ash }}>
              Creators must provide a clear, professionally formatted package that communicates the manuscript quickly and credibly. This may include:
            </p>
            <ul className="space-y-2 mb-6">
              {[
                "Query letter with a clear hook paragraph",
                "Synopsis or book-project overview",
                "Author bio",
                "Sample pages or manuscript materials",
                "Supporting materials — comparables, audience positioning, or optional readiness assessment",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-xs" style={{ color: C.ash }}>
                  <span style={{ color: C.gold, flexShrink: 0, marginTop: 1 }}>—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p
              className="text-xs p-3 border"
              style={{ color: C.ash, borderColor: C.border, backgroundColor: C.panel }}
            >
              A RevisionGrade-generated package may satisfy this requirement, but creators may also use equivalent professional materials created independently or through another service.{" "}
              <strong style={{ color: C.text }}>There is no requirement to purchase RevisionGrade services to qualify.</strong>
            </p>
          </div>

          <div
            className="p-8"
            style={{ border: `1px solid ${C.border}` }}
          >
            <p className="text-xs tracking-[0.18em] uppercase mb-1 font-mono" style={{ color: C.gold }}>
              Gate 2
            </p>
            <p
              className="text-lg font-bold mb-4"
              style={{ fontFamily: "Playfair Display, Georgia, serif" }}
            >
              Minimum Readiness / Quality Threshold
            </p>
            <p className="text-sm mb-5" style={{ color: C.ash }}>
              Manuscript projects must demonstrate a minimum professional standard through one of the following:
            </p>
            <ul className="space-y-2 mb-6">
              {[
                "A RevisionGrade score of 8.0 or higher from a full manuscript evaluation, or",
                "An equivalent professional manuscript assessment from a qualified third party — such as a literary agent, acquiring editor, professional editor, or recognized publishing evaluator",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-xs" style={{ color: C.ash }}>
                  <span style={{ color: C.gold, flexShrink: 0, marginTop: 1 }}>—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p
              className="text-xs p-3 border"
              style={{ color: C.ash, borderColor: C.border, backgroundColor: C.panel }}
            >
              Storygate Studio is not designed to replace professional judgment. It is designed to make professionally prepared manuscript projects easier to review, route, and protect.
            </p>
          </div>
        </div>
      </section>

      <Divider />

      <section className="py-0 pb-24 px-6 max-w-5xl mx-auto">
        <SectionLabel>Why It Exists</SectionLabel>
        <h2
          className="text-2xl md:text-3xl font-bold mb-6 max-w-2xl"
          style={{ fontFamily: "Playfair Display, Georgia, serif" }}
        >
          Good manuscript projects should not disappear into the black box.
        </h2>
        <p className="text-sm mb-6 max-w-2xl leading-relaxed" style={{ color: C.ash }}>
          Authors often face the same problem: silence, generic rejection, or no clear signal about whether the issue is manuscript readiness, market fit, timing, or access.
        </p>
        <p className="text-sm mb-8 max-w-2xl" style={{ color: C.ash }}>
          Storygate Studio does not promise representation, publication, or commercial outcome. It creates a more disciplined bridge between prepared creators and verified publishing professionals:
        </p>
        <ul className="space-y-3 mb-10 max-w-xl">
          {[
            "Creators keep control of their materials.",
            "Professionals see organized, readiness-vetted packages.",
            "Access is requested, approved, and logged.",
            "Projects are presented through a standard designed for serious review.",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm" style={{ color: C.text }}>
              <span style={{ color: C.gold, flexShrink: 0, marginTop: 2 }}>—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <Divider />

      <section className="py-0 pb-24 px-6 max-w-5xl mx-auto">
        <SectionLabel>Current Scope</SectionLabel>
        <h2
          className="text-2xl md:text-3xl font-bold mb-12"
          style={{ fontFamily: "Playfair Display, Georgia, serif" }}
        >
          Built for manuscript-first publishing pathways.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              type: "Novels",
              desc: "For long-form fiction projects prepared for literary-agent or publishing review.",
              materials: "Query letter, synopsis, author bio, sample pages, comparables, and optional evaluation summary.",
            },
            {
              type: "Memoir / Serious Nonfiction",
              desc: "For supported prose projects where author platform, subject relevance, and clear positioning matter.",
              materials: "Query package, synopsis or proposal-style summary where appropriate, author bio, and positioning notes.",
            },
            {
              type: "Complex Manuscripts",
              desc: "For multi-POV, multi-timeline, genre-hybrid, or unusually structured manuscript projects.",
              materials: "Professional manuscript package plus readiness evidence sufficient for controlled publishing review.",
            },
          ].map(({ type, desc, materials }) => (
            <div
              key={type}
              className="p-6"
              style={{ backgroundColor: C.panel, border: `1px solid ${C.borderAsh}` }}
            >
              <p
                className="text-xs tracking-[0.14em] uppercase mb-3 font-mono"
                style={{ color: C.gold }}
              >
                {type}
              </p>
              <p className="text-sm mb-4 leading-relaxed" style={{ color: C.text }}>
                {desc}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: C.ash }}>
                {materials}
              </p>
            </div>
          ))}
        </div>
      </section>

      <Divider />

      <section className="py-0 pb-24 px-6 max-w-5xl mx-auto">
        <SectionLabel>Scope</SectionLabel>
        <h2
          className="text-2xl md:text-3xl font-bold mb-6"
          style={{ fontFamily: "Playfair Display, Georgia, serif" }}
        >
          A professional gateway, not a guarantee.
        </h2>
        <p className="text-sm mb-6" style={{ color: C.ash }}>
          Storygate Studio is not:
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
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
              className="px-4 py-3 text-xs"
              style={{ backgroundColor: C.panel, border: `1px solid ${C.borderAsh}`, color: C.ash }}
            >
              {item}
            </div>
          ))}
        </div>
        <p className="text-sm italic max-w-2xl" style={{ color: C.ash }}>
          Storygate Studio is a selective access layer for professionally prepared manuscript projects. Industry response remains subjective and market-dependent.
        </p>
      </section>

      <Divider />

      <section
        className="py-20 px-6 text-center"
        style={{ backgroundColor: C.panel, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}
      >
        <SectionLabel>Enter the Right Door</SectionLabel>
        <h2
          className="text-2xl md:text-3xl font-bold mb-12"
          style={{ fontFamily: "Playfair Display, Georgia, serif" }}
        >
          Ready to proceed?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto text-left">
          <div>
            <p className="text-xs tracking-[0.16em] uppercase mb-2 font-mono" style={{ color: C.gold }}>
              Publishing Professionals
            </p>
            <p className="text-sm mb-5" style={{ color: C.ash }}>
              Request verified access to review selected manuscript projects.
            </p>
            <CTAButton href="/storygate-studio/industry" variant="gold">
              Request Publishing Access
            </CTAButton>
          </div>
          <div>
            <p className="text-xs tracking-[0.16em] uppercase mb-2 font-mono" style={{ color: C.gold }}>
              Authors and Creators
            </p>
            <p className="text-sm mb-5" style={{ color: C.ash }}>
              Prepare your manuscript project for eligibility and controlled publishing review.
            </p>
            <CTAButton href="/storygate-studio/apply" variant="ghost">
              Prepare a Project for Storygate
            </CTAButton>
          </div>
        </div>
      </section>

      <section className="py-24 px-6 max-w-3xl mx-auto">
        <SectionLabel>FAQ</SectionLabel>
        <h2
          className="text-2xl md:text-3xl font-bold mb-12"
          style={{ fontFamily: "Playfair Display, Georgia, serif" }}
        >
          Questions before you apply?
        </h2>
        <div className="space-y-8">
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
              className="pb-8"
              style={{ borderBottom: `1px solid ${C.borderAsh}` }}
            >
              <p
                className="text-sm font-semibold mb-2"
                style={{ fontFamily: "Playfair Display, Georgia, serif", color: C.text }}
              >
                {q}
              </p>
              <p className="text-sm leading-relaxed" style={{ color: C.ash }}>
                {a}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer
        className="py-8 px-6 text-center"
        style={{ borderTop: `1px solid ${C.borderAsh}` }}
      >
        <p className="text-xs max-w-xl mx-auto leading-relaxed" style={{ color: C.ash }}>
          Storygate Studio™ is part of the RevisionGrade™ ecosystem. It is designed to support professional manuscript readiness, controlled access, and accountable review pathways for serious book projects.
        </p>
        <p className="text-xs mt-3" style={{ color: C.gold, opacity: 0.6 }}>
          All project views, access requests, notes, and packet activity are logged and append-only. Materials may not be copied, shared, or distributed outside this verified account.
        </p>
      </footer>
    </main>
  );
}
