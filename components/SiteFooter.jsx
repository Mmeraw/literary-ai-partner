import Link from "next/link";

const footerGroups = [
  {
    title: "Product",
    links: [
      ["Evaluate", "/evaluate"],
      ["Revise", "/revise"],
      ["Agent Readiness", "/agent-readiness"],
      ["Storygate Studio", "/storygate-studio"],
      ["Pricing", "/pricing"],
    ],
  },
  {
    title: "Guides",
    links: [
      ["The Literary AI Partner™", "/literary-ai-partner"],
      ["AI Manuscript Evaluation", "/ai-manuscript-evaluation"],
      ["AI Novel Critique", "/ai-novel-critique"],
      ["Manuscript Revision Software", "/manuscript-revision-software"],
      ["Query Letter & Synopsis", "/query-letter-synopsis-generator"],
    ],
  },
  {
    title: "Resources",
    links: [
      ["Resources Hub", "/resources"],
      ["Methodology", "/methodology"],
      ["Editorial Doctrine", "/reliability"],
      ["The Black Box Problem", "/black-box-problem"],
      ["Sample Reports", "/ai-novel-critique"],
    ],
  },
  {
    title: "Trust & Support",
    links: [
      ["Privacy & Research Controls", "/privacy-research-controls"],
      ["Security & Access Controls", "/security"],
      ["Agent Readiness FAQ", "/agent-readiness/faq"],
      ["Storygate Studio FAQ", "/storygate-studio/faq"],
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-rg-cream2/10 bg-rg-ink px-6 py-10 text-rg-cream2">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.1fr_2.4fr]">
        <div>
          <Link href="/" className="font-rg-serif text-lg text-rg-cream">
            RevisionGrade&#8482;
          </Link>
          <p className="mt-3 max-w-sm text-sm leading-6 text-rg-cream2/70">
            The Literary AI Partner&#8482; for serious writers.
          </p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-rg-cream2/70">
            Manuscript diagnosis. Author-controlled revision. Professional submission preparation.
          </p>
          <p className="mt-5 text-xs text-rg-dim">© 2026 RevisionGrade&#8482;. All rights reserved.</p>
          <p className="mt-2 text-xs text-rg-dim">Built and operated from Canada and Mexico.</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {footerGroups.map((group) => (
            <div key={group.title}>
              <h2 className="font-rg-mono text-[0.68rem] uppercase tracking-[0.18em] text-rg-gold">
                {group.title}
              </h2>
              <div className="mt-3 flex flex-col gap-2 text-sm">
                {group.links.map(([label, href]) => (
                  <Link key={href} href={href} className="transition hover:text-rg-cream">
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
