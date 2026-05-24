/**
 * /storygate-studio/industry/forgot-password
 * Industry user password reset request.
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

export default function IndustryForgotPassword() {
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
          Reset Your Password
        </h1>
        <p className="text-sm mb-10 leading-relaxed" style={{ color: C.ash }}>
          Enter the email address associated with your verified industry account. If the address is on record, you will receive a reset link.
        </p>

        <div className="p-8" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}` }}>
          <label className="block text-xs tracking-[0.14em] uppercase font-mono mb-2" style={{ color: C.gold }}>
            Professional Email Address
          </label>
          <input
            type="email"
            placeholder="you@agency.com"
            className="w-full px-4 py-3 text-sm bg-transparent outline-none mb-6"
            style={{
              border: `1px solid ${C.borderAsh}`,
              color: C.text,
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          />
          <button
            type="submit"
            className="w-full px-6 py-3 text-xs tracking-[0.18em] uppercase font-mono transition-opacity hover:opacity-80"
            style={{ backgroundColor: C.gold, color: C.bg, border: "none" }}
          >
            Send Reset Link
          </button>
          <p className="mt-4 text-xs text-center" style={{ color: C.ash }}>
            Reset links expire after 1 hour and are single-use.
          </p>
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
