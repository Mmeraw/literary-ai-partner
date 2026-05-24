import Link from "next/link";

export default function ContactPage() {
  return (
    <div className="bg-rg-ink text-rg-cream">
      <section className="mx-auto max-w-5xl px-6 py-20">
        <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Contact</p>
        <h1 className="mt-6 font-rg-serif text-5xl leading-tight md:text-6xl">Talk to RevisionGrade.</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-rg-cream2/80">For private beta access, author questions, investor conversations, or product feedback, use the signed-in workflow or contact the team directly.</p>
        <div className="mt-10 border border-rg-cream2/12 bg-rg-ink2/60 p-8">
          <h2 className="font-rg-serif text-3xl">Private beta handoff</h2>
          <p className="mt-4 leading-7 text-rg-cream2/75">If you already have access, sign in and open Evaluate. If you are reviewing the product publicly, start with Resources, Reliability, and Methodology.</p>
          <div className="mt-7 flex flex-wrap gap-4 font-rg-mono text-xs uppercase tracking-[0.18em]"><Link href="/login" className="text-rg-gold hover:text-rg-cream">Sign in →</Link><Link href="/resources" className="text-rg-gold hover:text-rg-cream">Resources →</Link></div>
        </div>
      </section>
    </div>
  );
}
