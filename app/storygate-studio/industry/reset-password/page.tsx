/**
 * /storygate-studio/industry/reset-password
 * Industry user password reset confirmation.
 * Canonical Storygate palette.
 */

import Link from "next/link";

const C = {
  bg:        "#0E0E0E",
  text:      "#F2EFEA",
  gold:      "#A98E4A",
  ash:       "#7B7B7B",
  panel:     "#161616",
  border:    "rgba(161,142,74,0.18)",
  borderAsh: "rgba(123,123,123,0.18)",
} as const;

export default function IndustryResetPassword() {
  return (
    <main
      style={{ backgroundColor: C.bg, color: C.text, fontFamily: "Inter, system-ui, sans-serif", minHeight: "100vh" }}
    >
      <section className="pt-24 pb-20 px-6 max-w-md mx-auto">
        <p className="text-xs tracking-[0.22em] uppercase font-mono mb-4" style={{ color: C.gold }}>
          Storygate Studio™ — Industry
        </p>
        <h1
          className="text-3xl font-bold mb-4"
          style={{ fontFamily: "Playfair Display, Georgia, serif" }}
        >
          Set New Password
        </h1>
        <p className="text-sm mb-10 leading-relaxed" style={{ color: C.ash }}>
          Enter your new password below. The link in your email is single-use and expires after 1 hour.
        </p>

        <div className="p-8" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}` }}>
          <label className="block text-xs tracking-[0.14em] uppercase font-mono mb-2" style={{ color: C.gold }}>
            New Password
          </label>
          <input
            type="password"
            className="w-full px-4 py-3 text-sm bg-transparent outline-none mb-5"
            style={{ border: `1px solid ${C.borderAsh}`, color: C.text, fontFamily: "Inter, system-ui, sans-serif" }}
          />
          <label className="block text-xs tracking-[0.14em] uppercase font-mono mb-2" style={{ color: C.gold }}>
            Confirm New Password
          </label>
          <input
            type="password"
            className="w-full px-4 py-3 text-sm bg-transparent outline-none mb-6"
            style={{ border: `1px solid ${C.borderAsh}`, color: C.text, fontFamily: "Inter, system-ui, sans-serif" }}
          />
          <button
            type="submit"
            className="w-full px-6 py-3 text-xs tracking-[0.18em] uppercase font-mono transition-opacity hover:opacity-80"
            style={{ backgroundColor: C.gold, color: C.bg, border: "none" }}
          >
            Update Password
          </button>
        </div>

        <p className="mt-8 text-center">
          <Link
            href="/storygate-studio/industry"
            className="text-xs font-mono tracking-[0.14em] uppercase transition-opacity hover:opacity-70"
            style={{ color: C.gold }}
          >
            ← Back to Sign In
          </Link>
        </p>
      </section>
    </main>
  );
}
