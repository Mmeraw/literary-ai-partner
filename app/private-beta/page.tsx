/**
 * Private Beta gate — RevisionGrade
 *
 * Shown at revisiongrade.com/ until soft launch.
 * Design language: rg-ink background, editorial serif, ghost button.
 */
import Link from "next/link";

export default function PrivateBetaPage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-rg-ink flex flex-col items-center justify-center px-6 py-20">

      {/* Breadcrumb label */}
      <p className="font-rg-mono text-xs tracking-[0.25em] uppercase text-rg-cream2 mb-12">
        <span className="text-rg-red mr-2">●</span>
        RevisionGrade · Private Beta
      </p>

      {/* Headline */}
      <h1 className="font-rg-serif text-rg-cream text-5xl sm:text-6xl text-center leading-tight mb-3">
        A{" "}
        <span className="italic text-rg-gold" style={{ textDecorationLine: "underline", textDecorationColor: "#7A2B1A", textUnderlineOffset: "6px" }}>
          governed revision
        </span>
        {" "}operating system
      </h1>
      <h2 className="font-rg-serif text-rg-cream text-5xl sm:text-6xl text-center leading-tight mb-8">
        for serious manuscripts.
      </h2>

      {/* Body */}
      <p className="font-rg-serif text-rg-cream2 text-base text-center max-w-sm leading-relaxed mb-12">
        RevisionGrade is currently in private beta. Internal testers may sign in below.
      </p>

      {/* Gate card */}
      <div className="border border-rg-cream2/20 bg-rg-ink2 px-10 py-10 max-w-xs w-full text-center">

        <p className="font-rg-mono text-xs tracking-[0.2em] uppercase text-rg-cream2 mb-6">
          Internal Access
        </p>

        <Link
          href="/login"
          className="inline-block w-full border border-rg-cream2/50 text-rg-cream font-rg-mono text-xs tracking-widest uppercase px-6 py-3 hover:border-rg-gold hover:text-rg-gold transition-colors duration-200 text-center"
        >
          Sign In
        </Link>

        <p className="mt-6 font-rg-serif text-rg-cream2 text-xs leading-relaxed">
          Not yet a tester? Contact the administrator for access.
        </p>
      </div>

      {/* Footer doctrine line */}
      <p className="mt-16 font-rg-mono text-xs tracking-[0.2em] uppercase text-rg-cream2 text-center">
        Powered by the WAVE Revision System · 13 Story Evaluation Criteria
      </p>

    </div>
  );
}
