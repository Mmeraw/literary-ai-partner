const C = {
  bg: "#0E0E0E",
  text: "#F2EFEA",
  gold: "#A98E4A",
  ash: "#B8AEA0",
  panel: "#161616",
  border: "rgba(161,142,74,0.18)",
  borderAsh: "rgba(184,174,160,0.28)",
} as const;

const readinessBridge = [
  {
    code: "ABC",
    title: "Author Benchmark Calibration",
    body: "The manuscript is first understood against the author’s apparent intent: what kind of book this is trying to become, what experience it is promising, and whether the current draft can carry that ambition.",
  },
  {
    code: "D",
    title: "Market Demarcation",
    body: "The project is then placed against the right professional lane: genre, audience, shelf, comparable expectations, and the kind of publishing reader most likely to understand it.",
  },
  {
    code: "EFG",
    title: "Excellence Filtering & Gating",
    body: "Only then does Storygate ask the consequential question: is this manuscript ready for controlled professional review, still in revision, or not yet strong enough to cross the gate?",
  },
];

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

export default function StorygateReadinessBridge() {
  return (
    <section className="py-16 px-6 max-w-7xl mx-auto">
      <SectionLabel>The Storygate Readiness Bridge</SectionLabel>
      <h2
        className="text-3xl md:text-5xl font-bold mb-6 max-w-5xl leading-tight"
        style={{ fontFamily: "Playfair Display, Georgia, serif" }}
      >
        From private revision to professional readiness.
      </h2>
      <p className="text-lg mb-5 max-w-4xl leading-relaxed" style={{ color: C.ash }}>
        Storygate Studio is the bridge between the author’s manuscript and the professional reader. Before a project is placed in front of publishing professionals, it must be calibrated against the author’s intent, positioned against the correct market lane, and gated for readiness.
      </p>
      <p className="text-lg mb-10 max-w-4xl leading-relaxed" style={{ color: C.ash }}>
        Internally, that bridge is simple: <strong style={{ color: C.text }}>ABC → D → EFG</strong>. Publicly, it means a manuscript is not merely uploaded. It is prepared, positioned, and protected before it enters controlled professional review.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        {readinessBridge.map(({ code, title, body }) => (
          <div
            key={code}
            className="p-7"
            style={{ backgroundColor: C.panel, border: `1px solid ${C.border}` }}
          >
            <p className="text-xs tracking-[0.22em] uppercase mb-4 font-mono" style={{ color: C.gold }}>
              {code}
            </p>
            <h3
              className="text-xl font-bold mb-4"
              style={{ fontFamily: "Playfair Display, Georgia, serif", color: C.text }}
            >
              {title}
            </h3>
            <p className="text-base leading-relaxed" style={{ color: C.ash }}>
              {body}
            </p>
          </div>
        ))}
      </div>

      <div
        className="p-8 md:p-10 text-center"
        style={{ backgroundColor: C.panel, border: `1px solid ${C.borderAsh}` }}
      >
        <p className="text-xs tracking-[0.22em] uppercase mb-4 font-mono" style={{ color: C.gold }}>
          Have you been RevisionGraded?
        </p>
        <p
          className="text-2xl md:text-3xl font-bold mb-4"
          style={{ fontFamily: "Playfair Display, Georgia, serif", color: C.text }}
        >
          If your work has been diagnosed, repaired, and professionally packaged, Storygate Studio is the next gate.
        </p>
        <p className="text-base max-w-3xl mx-auto" style={{ color: C.ash }}>
          RevisionGrade helps establish the readiness signal. Storygate Studio gives that signal a controlled path toward verified publishing professionals.
        </p>
      </div>
    </section>
  );
}
