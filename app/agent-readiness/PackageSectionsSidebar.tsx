"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const sections = [
  { label: "Query Letter", href: "/agent-readiness/query-letter" },
  { label: "What Makes This Novel Unique", href: "/agent-readiness/query-letter#what-makes-this-novel-unique" },
  { label: "Synopsis", href: "/agent-readiness/synopsis" },
  { label: "Query Pitch", href: "/agent-readiness/pitch" },
  { label: "Comparables", href: "/agent-readiness/comparables" },
  { label: "Author Bio", href: "/agent-readiness/bio" },
  { label: "Package History", href: "/agent-readiness/history" },
];

function isActive(pathname: string, currentHash: string, href: string): boolean {
  const [base, hash] = href.split("#");
  if (pathname !== base) return false;
  if (!hash) return currentHash === "";
  return currentHash === `#${hash}`;
}

export default function PackageSectionsSidebar() {
  const pathname = usePathname() || "/";
  const [currentHash, setCurrentHash] = useState("");

  useEffect(() => {
    const syncHash = () => setCurrentHash(window.location.hash || "");
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  return (
    <aside className="lg:sticky lg:top-24 self-start border border-rg-cream2/10 bg-rg-ink2/40 p-5">
      <p className="font-rg-mono text-[0.62rem] uppercase tracking-[0.22em] text-rg-gold">Package Sections</p>

      <nav className="mt-5 flex flex-col gap-2" aria-label="Agent Readiness package sections">
        {sections.map((section) => {
          const active = isActive(pathname, currentHash, section.href);
          return (
            <Link
              key={section.href}
              href={section.href}
              className={[
                "block px-3 py-2 font-rg-mono text-xs uppercase tracking-[0.14em] transition-colors",
                active
                  ? "border border-rg-gold/60 bg-rg-gold/10 text-rg-gold"
                  : "border border-transparent text-rg-cream2 hover:border-rg-cream2/20 hover:text-rg-cream",
              ].join(" ")}
            >
              {section.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-5 border-t border-rg-cream2/10 pt-4">
        <Link
          href="/agent-readiness"
          className="font-rg-mono text-[0.62rem] uppercase tracking-[0.16em] text-rg-cream2 hover:text-rg-gold"
        >
          ← Back to Package Overview
        </Link>
      </div>
    </aside>
  );
}
