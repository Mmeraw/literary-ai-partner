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
    title: "Resources",
    links: [
      ["Resources Hub", "/resources"],
      ["The Black Box Problem", "/black-box-problem"],
      ["Methodology", "/methodology"],
      ["Editorial Doctrine", "/reliability"],
      ["Genre & Classification FAQ", "/genre-classification-faq"],
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
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.2fr_2fr]">
        <div>
          <Link href="/" className="font-rg-serif text-lg text-rg-cream">
            RevisionGrade&#8482;
          </Link>
          <p className="mt-3 max-w-sm text-sm leading-6 text-rg-cream2/70">
            Manuscript diagnosis, author-controlled revision, and professional submission preparation.
          </p>
          <p className="mt-5 text-xs text-rg-dim">RevisionGrade. All rights reserved.</p>
          <p className="mt-2 text-xs text-rg-dim">Operated from Canada and Mexico.</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
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
