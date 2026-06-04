/**
 * /storygate-studio/industry/dashboard
 *
 * Shell page only — actual dashboard logic lives in the Storygate Studio app
 * (storygate-studio/client/src/pages/IndustryDashboard.tsx).
 *
 * This page is the revisiongrade.com entry point. It checks auth via the
 * sg_industry_session cookie on the server side (middleware) and redirects
 * unauthenticated users back to /storygate-studio/industry.
 *
 * Authenticated users see a message + link to the live dashboard.
 * Production: this page should either proxy the embedded dashboard or
 * redirect directly to the deployed Storygate Studio app URL.
 */

import Link from "next/link";

const C = {
  bg:        "#0E0E0E",
  text:      "#F2EFEA",
  gold:      "#A98E4A",
  ash:       "#B8AEA0",
  panel:     "#161616",
  border:    "rgba(161,142,74,0.18)",
  borderAsh: "rgba(184,174,160,0.28)",
} as const;

export default function IndustryDashboardEntry() {
  return (
    <main
      className="storygate-studio-route"
      style={{ backgroundColor: C.bg, color: C.text, fontFamily: "Inter, system-ui, sans-serif", minHeight: "100vh" }}
    >
      <section className="pt-20 pb-14 px-6 max-w-6xl mx-auto text-center">
        <p className="text-sm tracking-[0.16em] uppercase font-mono mb-4" style={{ color: C.gold }}>
          Storygate Studio™
        </p>
        <h1
          className="text-4xl md:text-5xl font-bold mb-5"
          style={{ fontFamily: "Playfair Display, Georgia, serif" }}
        >
          Industry Dashboard
        </h1>
        <p className="text-lg leading-relaxed mb-9 max-w-5xl mx-auto" style={{ color: C.ash }}>
          You are entering the verified industry access area. This environment is logged. All activity—views, access requests, notes, and packet interactions—is recorded and append-only.
        </p>

        <div className="p-8 mb-6 text-left max-w-5xl mx-auto" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}` }}>
          <p className="text-sm tracking-[0.11em] uppercase font-mono mb-3" style={{ color: C.gold }}>
            Access Policy
          </p>
          <ul className="space-y-3">
            {[
              "Materials may not be copied, shared, or distributed outside this verified account.",
              "Access does not imply representation, endorsement, or obligation.",
              "Decisions on materials are final and append-only within the system.",
              "Violation of access terms may result in immediate revocation.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-base" style={{ color: C.ash }}>
                <span style={{ color: C.gold, flexShrink: 0 }}>—</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Primary CTA — links to the deployed Storygate Studio app */}
        <Link
          href="https://www.perplexity.ai/computer/a/storygate-studio-9n2UVN40RGiCPIz5u5tlwg#/storygate-studio/industry/dashboard"
          className="inline-block w-full max-w-5xl text-center px-6 py-4 text-sm tracking-[0.12em] uppercase font-mono transition-opacity hover:opacity-80 mb-4"
          style={{ backgroundColor: C.gold, color: C.bg }}
        >
          Open Industry Dashboard
        </Link>

        <p className="text-base" style={{ color: C.ash }}>
          Not your account?{" "}
          <Link href="/storygate-studio/industry" className="underline underline-offset-2 hover:opacity-70" style={{ color: C.gold }}>
            Sign in with a different account
          </Link>
        </p>

        <p className="mt-8 text-base leading-relaxed" style={{ color: C.ash, opacity: 0.75 }}>
          All project views, access requests, notes, and packet activity are logged and append-only.
        </p>
      </section>
    </main>
  );
}
