"use client";

/**
 * HeaderNav — RevisionGrade canonical navigation shell
 *
 * Signed-in nav order (per product doctrine):
 *   Dashboard · Evaluate · Revise · Agent Readiness Package™ · Storygate Studio™ · Resources · Pricing
 *   Admin-only: Pipeline
 *
 * Auth states:
 *   "loading" — session check in-flight; render skeleton (no flash)
 *   "authed"  — valid session
 *   "anon"    — no session
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isPipelineHealthAdminEmail } from "@/lib/admin/pipelineHealthAllowlist";

const storygateLinks = [
  ["Overview",              "/storygate-studio"],
  ["Prepare a Project",    "/storygate-studio/apply"],
  ["Storygate FAQ",        "/storygate-studio/faq"],
  ["Request Industry Access", "/storygate-studio/industry"],
  ["Agent Dashboard",      "/storygate-studio/industry/dashboard"],
];

const resourceLinks = [
  ["Resources Hub",                 "/resources"],
  ["The Black Box Problem",         "/black-box-problem"],
  ["Methodology",                   "/methodology"],
  ["Editorial Doctrine",            "/reliability"],
  ["Privacy & Research Controls",   "/privacy-research-controls"],
  ["Security & Access Controls",    "/security"],
  ["Genre & Classification FAQ",    "/genre-classification-faq"],
  ["Storygate Studio FAQ",          "/storygate-studio/faq"],
  ["Agent Readiness FAQ",           "/agent-readiness/faq"],
];

const resourceActiveHrefs = [
  "/resources",
  "/black-box-problem",
  "/methodology",
  "/reliability",
  "/privacy-research-controls",
  "/security",
  "/genre-classification-faq",
  "/storygate-studio/faq",
  "/agent-readiness/faq",
];

const arpLinks = [
  ["Package Workspace",          "/agent-readiness"],
  ["Query Letter",               "/agent-readiness/query-letter"],
  ["Synopsis Builder",           "/agent-readiness/synopsis"],
  ["Query Pitch Builder",        "/agent-readiness/pitch"],
  ["Author Bio",                 "/agent-readiness/bio"],
  ["Comparables & Positioning",  "/agent-readiness/comparables"],
  ["Package History / Export",   "/agent-readiness/history"],
  ["Agent Readiness FAQ",        "/agent-readiness/faq"],
];

const arpActiveHref = "/agent-readiness";

export default function HeaderNav() {
  const pathname = usePathname() || "/";
  const router = useRouter();

  const resourcesMenuRef = useRef(null);
  const arpMenuRef       = useRef(null);
  const sgMenuRef        = useRef(null);

  const [authState,     setAuthState]    = useState("loading");
  const [email,         setEmail]        = useState(null);
  const [signingOut,    setSigningOut]   = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [arpOpen,       setArpOpen]       = useState(false);
  const [sgOpen,        setSgOpen]        = useState(false);
  const [mobileOpen,    setMobileOpen]    = useState(false);

  const isAdmin  = isPipelineHealthAdminEmail(email);
  const isAuthed = authState === "authed";

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/user", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const resolvedEmail = (data && data.user && data.user.email) || null;
        setEmail(resolvedEmail);
        setAuthState(resolvedEmail ? "authed" : "anon");
      })
      .catch(() => {
        if (!cancelled) { setEmail(null); setAuthState("anon"); }
      });
    return () => { cancelled = true; };
  }, [pathname]);

  useEffect(() => {
    setMobileOpen(false);
    setResourcesOpen(false);
    setArpOpen(false);
    setSgOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!resourcesOpen && !arpOpen && !sgOpen) return;
    function handlePointerDown(e) {
      if (resourcesOpen && resourcesMenuRef.current && !resourcesMenuRef.current.contains(e.target)) setResourcesOpen(false);
      if (arpOpen      && arpMenuRef.current       && !arpMenuRef.current.contains(e.target))       setArpOpen(false);
      if (sgOpen       && sgMenuRef.current        && !sgMenuRef.current.contains(e.target))        setSgOpen(false);
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") { setResourcesOpen(false); setArpOpen(false); setSgOpen(false); setMobileOpen(false); }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [resourcesOpen, arpOpen, sgOpen]);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try { await fetch("/api/auth/signout", { method: "POST", credentials: "include", cache: "no-store" }); }
    catch { /* best-effort */ }
    setEmail(null); setAuthState("anon");
    router.push("/"); router.refresh();
    setSigningOut(false);
  }

  const linkCls       = "text-xs tracking-widest uppercase font-rg-mono text-rg-cream2 hover:text-rg-cream transition-colors duration-150";
  const activeLinkCls = "text-xs tracking-widest uppercase font-rg-mono text-rg-gold";
  const mobileLinkCls = "block rounded-sm border border-rg-cream2/10 px-3 py-3 font-rg-mono text-xs uppercase tracking-[0.16em] text-rg-cream2 transition hover:border-rg-gold/50 hover:text-rg-cream";
  const mobileActiveLinkCls = "block rounded-sm border border-rg-gold/50 px-3 py-3 font-rg-mono text-xs uppercase tracking-[0.16em] text-rg-gold";

  function NavLink({ href, children }) {
    const active = pathname === href || pathname.startsWith(href + "/");
    return <Link href={href} className={active ? activeLinkCls : linkCls}>{children}</Link>;
  }

  function MobileLink({ href, children }) {
    const active = pathname === href || pathname.startsWith(href + "/");
    return <Link href={href} className={active ? mobileActiveLinkCls : mobileLinkCls}>{children}</Link>;
  }

  const resourcesActive = resourceActiveHrefs.some((h) => pathname === h || pathname.startsWith(`${h}/`));
  const arpActive       = pathname === arpActiveHref || pathname.startsWith(`${arpActiveHref}/`);

  const dropdownCls = "absolute left-1/2 top-8 z-50 -translate-x-1/2 border border-rg-cream2/15 bg-rg-ink2 p-3 shadow-xl shadow-black/30";
  const dropdownItemCls = "block px-3 py-2 font-rg-mono text-xs uppercase tracking-[0.14em] text-rg-cream2 hover:text-rg-cream whitespace-nowrap";

  return (
    <header className="sticky top-0 z-50 w-full max-w-full border-b border-rg-cream2/10 bg-rg-ink">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 shrink-0 items-center gap-3 group">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-rg-gold/60 text-rg-gold font-rg-serif text-sm group-hover:border-rg-gold transition-colors duration-150">R</span>
          <span className="hidden text-rg-cream font-rg-serif text-sm tracking-wide sm:block">RevisionGrade&#8482;</span>
        </Link>

        <nav className="hidden items-center justify-center gap-6 lg:flex lg:flex-1">
          {isAuthed && <NavLink href="/dashboard">Dashboard</NavLink>}

          <NavLink href="/evaluate">Evaluate</NavLink>
          <NavLink href="/revise">Revise</NavLink>

          {isAuthed ? (
            <div className="relative" ref={arpMenuRef}>
              <button
                type="button"
                onClick={() => { setArpOpen((v) => !v); setResourcesOpen(false); setSgOpen(false); }}
                className={arpActive ? activeLinkCls : linkCls}
                aria-expanded={arpOpen}
                aria-haspopup="menu"
                aria-controls="arp-menu"
              >
                Agent Readiness&#8482;
              </button>
              {arpOpen && (
                <div id="arp-menu" className={`${dropdownCls} w-64`} role="menu">
                  {arpLinks.map(([label, href]) => (
                    <Link key={href} href={href} role="menuitem" onClick={() => setArpOpen(false)} className={dropdownItemCls}>
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <NavLink href="/agent-readiness">Agent Readiness&#8482;</NavLink>
          )}

          <div className="relative" ref={sgMenuRef}>
            <button
              type="button"
              onClick={() => { setSgOpen((v) => !v); setArpOpen(false); setResourcesOpen(false); }}
              className="text-xs tracking-widest uppercase font-rg-mono transition-colors duration-150 hover:opacity-80"
              style={{ color: "#FF0000" }}
              aria-expanded={sgOpen}
              aria-haspopup="menu"
              aria-controls="sg-menu"
            >
              Storygate Studio&#8482;
            </button>
            {sgOpen && (
              <div id="sg-menu" className={`${dropdownCls} w-64`} role="menu">
                {storygateLinks.map(([label, href]) => (
                  <Link key={href} href={href} role="menuitem" onClick={() => setSgOpen(false)} className={dropdownItemCls}>
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="relative" ref={resourcesMenuRef}>
            <button
              type="button"
              onClick={() => { setResourcesOpen((v) => !v); setArpOpen(false); setSgOpen(false); }}
              className={resourcesActive ? activeLinkCls : linkCls}
              aria-expanded={resourcesOpen}
              aria-haspopup="menu"
              aria-controls="resources-menu"
            >
              Resources
            </button>
            {resourcesOpen && (
              <div id="resources-menu" className={`${dropdownCls} w-72`} role="menu">
                {resourceLinks.map(([label, href]) => (
                  <Link key={href} href={href} role="menuitem" onClick={() => setResourcesOpen(false)} className={dropdownItemCls}>
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <NavLink href="/pricing">Pricing</NavLink>
          {isAuthed && isAdmin && <NavLink href="/admin/pipeline-health">Pipeline</NavLink>}
        </nav>

        <div className="hidden shrink-0 lg:block">
          {authState === "loading" && (
            <span className="inline-block w-14 h-5 rounded bg-rg-cream2/10 animate-pulse" />
          )}
          {authState === "authed" && (
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              data-testid="nav-signout"
              className="text-xs tracking-widest uppercase font-rg-mono text-rg-dim hover:text-rg-cream2 transition-colors duration-150 disabled:opacity-40"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          )}
          {authState === "anon" && (
            <Link href="/login" data-testid="nav-signin" className="text-xs tracking-widest uppercase font-rg-mono border border-rg-gold text-rg-gold px-3 py-1.5 hover:bg-rg-gold hover:text-rg-ink transition-colors duration-150">
              Sign in
            </Link>
          )}
        </div>

        <button
          type="button"
          className="inline-flex shrink-0 items-center justify-center border border-rg-gold/60 px-3 py-2 font-rg-mono text-[0.68rem] uppercase tracking-[0.16em] text-rg-gold transition hover:border-rg-gold hover:text-rg-cream lg:hidden"
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? "Close" : "Menu"}
        </button>
      </div>

      {mobileOpen && (
        <div id="mobile-nav" className="border-t border-rg-cream2/10 bg-rg-ink lg:hidden">
          <nav className="mx-auto grid max-w-7xl gap-2 px-4 py-4 sm:px-6" aria-label="Mobile navigation">
            {isAuthed && <MobileLink href="/dashboard">Dashboard</MobileLink>}
            <MobileLink href="/evaluate">Evaluate</MobileLink>
            <MobileLink href="/revise">Revise</MobileLink>
            <MobileLink href="/agent-readiness">Agent Readiness&#8482;</MobileLink>
            <MobileLink href="/storygate-studio">Storygate Studio&#8482;</MobileLink>
            <MobileLink href="/resources">Resources</MobileLink>
            <MobileLink href="/pricing">Pricing</MobileLink>
            {isAuthed && isAdmin && <MobileLink href="/admin/pipeline-health">Pipeline</MobileLink>}

            <div className="mt-2 border-t border-rg-cream2/10 pt-4">
              {authState === "loading" && (
                <span className="inline-block h-5 w-20 rounded bg-rg-cream2/10 animate-pulse" />
              )}
              {authState === "authed" && (
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  data-testid="mobile-nav-signout"
                  className="w-full border border-rg-cream2/20 px-3 py-3 text-left font-rg-mono text-xs uppercase tracking-[0.16em] text-rg-cream2 transition hover:border-rg-gold/50 hover:text-rg-cream disabled:opacity-40"
                >
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              )}
              {authState === "anon" && (
                <Link href="/login" data-testid="mobile-nav-signin" className="block border border-rg-gold px-3 py-3 font-rg-mono text-xs uppercase tracking-[0.16em] text-rg-gold transition hover:bg-rg-gold hover:text-rg-ink">
                  Sign in
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
