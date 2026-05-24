/**
 * /storygate-studio/industry — Industry user sign-in / registration gate
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

export default function IndustryGate() {
  return (
    <main
      style={{ backgroundColor: C.bg, color: C.text, fontFamily: "Inter, system-ui, sans-serif", minHeight: "100vh" }}
    >
      <section className="pt-24 pb-20 px-6 max-w-2xl mx-auto">
        <p className="text-xs tracking-[0.22em] uppercase font-mono mb-4" style={{ color: C.gold }}>
          Storygate Studio™ — Industry Access
        </p>
        <h1
          className="text-4xl font-bold mb-6 leading-tight"
          style={{ fontFamily: "Playfair Display, Georgia, serif" }}
        >
          Verified Industry Access
        </h1>
        <p className="text-sm leading-relaxed mb-10" style={{ color: C.ash }}>
          Storygate Studio is not a public marketplace. Access is available only to verified publishing and screen industry professionals. Sign in to your existing account, or request access to apply for verification.
        </p>

        {/* Sign in panel */}
        <div className="p-8 mb-6" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}` }}>
          <p className="text-xs tracking-[0.16em] uppercase font-mono mb-6" style={{ color: C.gold }}>
            Existing Account
          </p>
          <Link
            href="/storygate-studio/industry/dashboard"
            className="inline-block w-full text-center px-6 py-4 text-xs tracking-[0.18em] uppercase font-mono transition-opacity hover:opacity-80"
            style={{ backgroundColor: C.gold, color: C.bg }}
          >
            Sign In to Industry Dashboard
          </Link>
          <p className="mt-4 text-center">
            <Link
              href="/storygate-studio/industry/forgot-password"
              className="text-xs font-mono tracking-[0.12em] transition-opacity hover:opacity-70"
              style={{ color: C.ash }}
            >
              Forgot password?
            </Link>
          </p>
        </div>

        {/* Request access panel */}
        <div className="p-8" style={{ border: `1px solid ${C.borderAsh}` }}>
          <p className="text-xs tracking-[0.16em] uppercase font-mono mb-3" style={{ color: C.gold }}>
            New to Storygate Studio
          </p>
          <p className="text-sm leading-relaxed mb-6" style={{ color: C.ash }}>
            Industry access requires verification. You will need to provide your professional affiliation, role, and contact information. Accounts are manually reviewed before access is granted.
          </p>
          <p className="text-xs mb-6 px-4 py-3" style={{ backgroundColor: C.bg, border: `1px solid ${C.borderAsh}`, color: C.ash }}>
            Required: Full name, company or affiliation, professional role, professional email address (no free email domains), and LinkedIn or company website.
          </p>
          <button
            disabled
            className="inline-block w-full text-center px-6 py-4 text-xs tracking-[0.18em] uppercase font-mono opacity-40 cursor-not-allowed"
            style={{ backgroundColor: "transparent", color: C.gold, border: `1px solid ${C.gold}` }}
          >
            Request Industry Access — Opening Soon
          </button>
          <p className="mt-4 text-xs text-center" style={{ color: C.ash }}>
            Industry access applications are currently by invitation only during the initial rollout.
          </p>
        </div>

        {/* Trust line */}
        <p
          className="mt-10 text-xs text-center leading-relaxed"
          style={{ color: C.ash, borderTop: `1px solid ${C.borderAsh}`, paddingTop: "1.5rem" }}
        >
          All project views, access requests, notes, and packet activity are logged and append-only. Materials may not be copied, shared, or distributed outside this verified account.
        </p>
        <p
          className="mt-3 text-xs text-center"
          style={{ color: C.ash, opacity: 0.6 }}
        >
          Access does not imply representation or obligation.
        </p>
      </section>

      <footer className="py-6 px-6 text-center" style={{ borderTop: `1px solid ${C.borderAsh}` }}>
        <Link href="/storygate-studio" className="text-xs font-mono tracking-[0.14em] uppercase transition-opacity hover:opacity-70" style={{ color: C.gold }}>
          ← Back to Storygate Studio Overview
        </Link>
      </footer>
    </main>
  );
}
