"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

const packageSections = [
  { label: "Query Letter", href: "/agent-readiness/query-letter" },
  { label: "What Makes This Novel Unique", href: "/agent-readiness/query-letter#what-makes-this-novel-unique" },
  { label: "Synopsis", href: "/agent-readiness/synopsis" },
  { label: "Query Pitch", href: "/agent-readiness/pitch" },
  { label: "Comparables", href: "/agent-readiness/comparables" },
  { label: "Author Bio", href: "/agent-readiness/bio" },
];

const packageTools = [
  { label: "Agent Targeting™", href: "#", meta: "Coming Next", disabled: true },
  { label: "Package History / Export", href: "/agent-readiness/history" },
  { label: "Agent Readiness FAQ", href: "/agent-readiness/faq" },
];

function splitHref(href: string): { base: string; hash: string } {
  const [base, hash = ""] = href.split("#");
  return { base, hash: hash ? `#${hash}` : "" };
}

function isActive(pathname: string, currentHash: string, href: string): boolean {
  const { base, hash } = splitHref(href);
  if (pathname !== base) return false;
  if (!hash) return currentHash === "";
  return currentHash === hash;
}

function buildHref(href: string, queryString: string): string {
  if (href === "#") return href;
  const { base, hash } = splitHref(href);
  return `${base}${queryString}${hash}`;
}

export default function PackageSectionsSidebar() {
  return (
    <Suspense fallback={<aside className="agent-readiness-sidebar" />}>
      <PackageSectionsSidebarInner />
    </Suspense>
  );
}

function PackageSectionsSidebarInner() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const [currentHash, setCurrentHash] = useState("");

  const queryString = useMemo(() => {
    const manuscriptId = searchParams.get("manuscriptId");
    const evaluationJobId = searchParams.get("evaluationJobId");
    if (!manuscriptId || !evaluationJobId) return "";
    const params = new URLSearchParams({ manuscriptId, evaluationJobId });
    return `?${params.toString()}`;
  }, [searchParams]);

  useEffect(() => {
    const syncHash = () => setCurrentHash(window.location.hash || "");
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  return (
    <aside className="agent-readiness-sidebar">
      <Link href={`/agent-readiness${queryString}`} className="agent-readiness-sidebar-title">
        Agent Readiness Package™
      </Link>

      <p className="agent-readiness-sidebar-kicker">Package Sections</p>
      <nav className="agent-readiness-sidebar-nav" aria-label="Agent Readiness package sections">
        {packageSections.map((section, index) => {
          const active = isActive(pathname, currentHash, section.href);
          return (
            <Link
              key={section.href}
              href={buildHref(section.href, queryString)}
              className={active ? "agent-readiness-sidebar-link is-active" : "agent-readiness-sidebar-link"}
            >
              <span className="agent-readiness-sidebar-index">{String(index + 1).padStart(2, "0")}</span>
              <span>{section.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="agent-readiness-sidebar-divider" />

      <p className="agent-readiness-sidebar-kicker">Package Tools</p>
      <nav className="agent-readiness-sidebar-nav" aria-label="Agent Readiness package tools">
        {packageTools.map((tool) => {
          const active = !tool.disabled && isActive(pathname, currentHash, tool.href);
          if (tool.disabled) {
            return (
              <div key={tool.label} className="agent-readiness-sidebar-link is-disabled" aria-disabled="true">
                <span>{tool.label}</span>
                {tool.meta && <small>{tool.meta}</small>}
              </div>
            );
          }
          return (
            <Link
              key={tool.href}
              href={buildHref(tool.href, queryString)}
              className={active ? "agent-readiness-sidebar-link is-active" : "agent-readiness-sidebar-link"}
            >
              <span>{tool.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
