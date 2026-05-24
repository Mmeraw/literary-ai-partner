import Link from "next/link";

const productLinks = [
  ["Evaluate", "/evaluate"],
  ["Revise", "/revise"],
  ["The Queue", "/queue"],
  ["Pricing", "/pricing"],
];

const trustLinks = [
  ["The Black Box Problem", "/black-box-problem"],
  ["Resources", "/resources"],
  ["Reliability", "/reliability"],
  ["Methodology", "/methodology"],
  ["Contact", "/contact"],
];

const legalLinks = [
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
];

function LinkColumn({ title, links }) {
  return (
    <div>
      <h3 className="font-rg-mono text-xs uppercase tracking-[0.22em] text-rg-gold">{title}</h3>
      <ul className="mt-4 space-y-3">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="text-sm text-rg-cream2/80 transition hover:text-rg-cream">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SiteFooter() {
  return (
    <footer className="border-t border-rg-cream2/10 bg-rg-ink text-rg-cream">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-[1.3fr_0.7fr_0.7fr_0.7fr]">
        <div>
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center border border-rg-gold/60 font-rg-serif text-rg-gold">R</span>
            <span className="font-rg-serif text-lg tracking-wide">RevisionGrade™</span>
          </Link>
          <p className="mt-5 max-w-md text-sm leading-7 text-rg-cream2/75">
            A governed revision operating system for serious manuscripts: evaluation, repair queues, author control, and trust surfaces under one routed app shell.
          </p>
        </div>
        <LinkColumn title="Product" links={productLinks} />
        <LinkColumn title="Trust" links={trustLinks} />
        <LinkColumn title="Legal" links={legalLinks} />
      </div>
      <div className="border-t border-rg-cream2/10 px-6 py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 text-xs text-rg-dim md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} RevisionGrade™. All rights reserved.</span>
          <span>One layout. One navigation model. No ghost marketing routes.</span>
        </div>
      </div>
    </footer>
  );
}
