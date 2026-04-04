import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-16 py-8">
      {/* Hero */}
      <section className="text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Professional Literary Evaluation &amp; Revision
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-slate-600">
          RevisionGrade&trade; delivers structured, multi-phase manuscript evaluation
          powered by the WAVE system. Get actionable feedback, revision guidance,
          and publication-ready output.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/evaluate"
            className="inline-flex items-center rounded-xl bg-indigo-600 px-6 py-3 text-white font-medium hover:bg-indigo-700 transition"
          >
            Get Started &rarr;
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center rounded-xl border border-slate-300 px-6 py-3 text-slate-700 font-medium hover:bg-slate-50 transition"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center rounded-xl border border-indigo-300 px-6 py-3 text-indigo-700 font-medium hover:bg-indigo-50 transition"
          >
            Sign Up
          </Link>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20">
        <h2 className="text-2xl font-semibold text-slate-900 mb-6 text-center">Features</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: "Multi-Phase Evaluation", desc: "Structured analysis across narrative, style, and craft dimensions." },
            { title: "Revision Guidance", desc: "Targeted recommendations with priority ranking and implementation notes." },
            { title: "Content Conversion", desc: "Transform manuscripts between formats with fidelity scoring." },
            { title: "Publication Output", desc: "Generate submission-ready packages for agents and publishers." },
            { title: "Progress Tracking", desc: "Dashboard views of evaluation status, jobs, and revision history." },
            { title: "Admin Observability", desc: "Real-time diagnostics, job monitoring, and dead-letter management." },
          ].map((f) => (
            <div key={f.title} className="rounded-lg border border-slate-200 p-5 hover:shadow-md transition">
              <h3 className="font-medium text-slate-900 mb-1">{f.title}</h3>
              <p className="text-sm text-slate-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WAVE System */}
      <section id="wave" className="scroll-mt-20">
        <h2 className="text-2xl font-semibold text-slate-900 mb-4 text-center">The WAVE System</h2>
        <p className="mx-auto max-w-2xl text-center text-slate-600 mb-6">
          Our proprietary evaluation framework scores manuscripts across four pillars:
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { letter: "W", label: "Writing Craft", color: "bg-blue-100 text-blue-800" },
            { letter: "A", label: "Audience Engagement", color: "bg-green-100 text-green-800" },
            { letter: "V", label: "Voice & Style", color: "bg-purple-100 text-purple-800" },
            { letter: "E", label: "Execution Quality", color: "bg-orange-100 text-orange-800" },
          ].map((w) => (
            <div key={w.letter} className="rounded-lg border border-slate-200 p-5 text-center">
              <span className={`inline-block text-2xl font-bold rounded-lg px-3 py-1 mb-2 ${w.color}`}>
                {w.letter}
              </span>
              <p className="font-medium text-slate-900">{w.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Packages */}
      <section id="packages" className="scroll-mt-20">
        <h2 className="text-2xl font-semibold text-slate-900 mb-6 text-center">Packages</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { name: "Essentials", price: "Free", features: ["Single manuscript evaluation", "Basic WAVE scoring", "Summary feedback"] },
            { name: "Professional", price: "$29/mo", features: ["Unlimited evaluations", "Full WAVE reports", "Revision tracking", "Content conversion"] },
            { name: "Studio", price: "$79/mo", features: ["Everything in Professional", "Storygate Studio access", "Priority processing", "Admin dashboard"] },
          ].map((pkg) => (
            <div key={pkg.name} className="rounded-lg border border-slate-200 p-6 flex flex-col">
              <h3 className="text-lg font-semibold text-slate-900">{pkg.name}</h3>
              <p className="text-2xl font-bold text-indigo-600 mt-2 mb-4">{pkg.price}</p>
              <ul className="space-y-2 text-sm text-slate-600 flex-1">
                {pkg.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">&#10003;</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/evaluate"
                className="mt-6 block text-center rounded-lg bg-indigo-600 px-4 py-2 text-white text-sm font-medium hover:bg-indigo-700 transition"
              >
                Get Started
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 pt-8 text-center text-sm text-slate-500">
        <p>&copy; {new Date().getFullYear()} RevisionGrade&trade;. All rights reserved.</p>
      </footer>
    </div>
  );
}
