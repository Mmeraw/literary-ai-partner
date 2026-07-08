"use client";

/**
 * HeaderNav — RevisionGrade canonical navigation shell
 *
 * Public nav keeps scarce header space for user-facing product routes.
 * Admin routes are private and live inside Resources for allow-listed admins.
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
  ["Author FAQ",                    "/faq"],
  ["The Black Box Problem",         "/black-box-problem"],
  ["Methodology",                   "/methodology"],
  ["Editorial Doctrine",            "/reliability"],
  ["Privacy & Research Controls",   "/privacy-research-controls"],
  ["Security & Access Controls",    "/security"],
  ["Genre & Classification FAQ",    "/genre-classification-faq"],
  ["Storygate Studio FAQ",          "/storygate-studio/faq"],
  ["Agent Readiness FAQ",           "/agent-readiness/faq"],
];

const adminResourceLinks = [
  ["Admin Control Center", "/admin"],
  ["Eval Monitor", "/admin/eval-monitor"],
  ["Pipeline Health", "/admin/pipeline-health"],
  ["Evaluation Jobs", "/admin/jobs"],
  ["Diagnostics", "/admin/diagnostics"],
  ["CostOps", "/admin/costs"],
];

const resourceActiveHrefs = [
  "/resources",
  "/faq",
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

const reviseLinks = [
  ["Revise Queue",       "/revise-queue"],
  ["Revise Workbench",  "/workbench-v2"],
];

const reviseActiveHrefs = ["/revise", "/revise-queue", "/workbench-v2", "/workbench"];

export default function HeaderNav() {
  const pathname = usePathname() || "/";
  const router = useRouter();

  const resourcesMenuRef = useRef(null);
  const arpMenuRef       = useRef(null);
  const sgMenuRef        = useRef(null);
  const reviseMenuRef    = useRef(null);

  const [authState,     setAuthState]    = useState("loading");
  const [email,         setEmail]        = useState(null);
  const [signingOut,    setSigningOut]   = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [arpOpen,       setArpOpen]       = useState(false);
  const [sgOpen,        setSgOpen]        = useState(false);
  const [reviseOpen,    setReviseOpen]    = useState(false);
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
    setReviseOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!resourcesOpen && !arpOpen && !sgOpen && !reviseOpen) return;
    function handlePointerDown(e) {
      if (resourcesOpen && resourcesMenuRef.current && !resourcesMenuRef.current.contains(e.target)) setResourcesOpen(false);
      if (arpOpen      && arpMenuRef.current       && !arpMenuRef.current.contains(e.target))       setArpOpen(false);
      if (sgOpen       && sgMenuRef.current        && !sgMenuRef.current.contains(e.target))        setSgOpen(false);
      if (reviseOpen   && reviseMenuRef.current    && !reviseMenuRef.current.contains(e.target))    setReviseOpen(false);
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") { setResourcesOpen(false); setArpOpen(false); setSgOpen(false); setReviseOpen(false); setMobileOpen(false); }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [resourcesOpen, arpOpen, sgOpen, reviseOpen]);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try { await fetch("/api/auth/signout", { method: "POST", credentials: "include", cache: "no-store" }); }
    catch { /* best-effort */ }
    setEmail(null); setAuthState("anon");
    router.push("/"); router.refresh();
    setSigningOut(false);
  }

  const linkCls       = "whitespace-nowrap font-rg-mono text-[0.8rem] font-semibold normal-case tracking-[0.02em] text-rg-cream hover:text-white transition-colors duration-150 xl:text-[0.86rem]";
  const activeLinkCls = "whitespace-nowrap font-rg-mono text-[0.8rem] font-semibold normal-case tracking-[0.02em] text-rg-gold xl:text-[0.86rem]";
  const mobileLinkCls = "block rounded-sm border border-rg-cream2/10 px-3 py-3 font-rg-mono text-sm normal-case tracking-[0.02em] text-rg-cream2 transition hover:border-rg-gold/50 hover:text-rg-cream";
  const mobileActiveLinkCls = "block rounded-sm border border-rg-gold/50 px-3 py-3 font-rg-mono text-sm normal-case tracking-[0.02em] text-rg-gold";

  function NavLink({ href, children }) {
    const active = pathname === href || pathname.startsWith(href + "/");
    return <Link href={href} className={active ? activeLinkCls : linkCls}>{children}</Link>;
  }

  function MobileLink({ href, children }) {
    const active = pathname === href || pathname.startsWith(href + "/");
    return <Link href={href} className={active ? mobileActiveLinkCls : mobileLinkCls}>{children}</Link>;
  }

  const adminActive = pathname === "/admin" || pathname.startsWith("/admin/");
  const resourcesActive = resourceActiveHrefs.some((h) => pathname === h || pathname.startsWith(`${h}/`)) || (isAdmin && adminActive);
  const arpActive       = pathname === arpActiveHref || pathname.startsWith(`${arpActiveHref}/`);
  const visibleResourceLinks = isAdmin
    ? [...resourceLinks, ["Admin Tools", "#admin-tools"], ...adminResourceLinks]
    : resourceLinks;

  const dropdownCls = "absolute left-1/2 top-8 z-50 -translate-x-1/2 border border-rg-cream2/15 bg-rg-ink2 p-3 shadow-xl shadow-black/30";
  const dropdownItemCls = "block px-3 py-2 font-rg-mono text-xs normal-case tracking-[0.03em] text-rg-cream2 hover:text-rg-cream whitespace-nowrap";

  return (
    <header className="sticky top-0 z-50 w-full max-w-full border-b border-rg-cream2/10 bg-rg-ink">
      <div className="mx-auto flex h-14 max-w-[1640px] items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 shrink-0 items-center gap-3 group">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-rg-gold/60 text-rg-gold font-rg-serif text-sm group-hover:border-rg-gold transition-colors duration-150">R</span>
          <span className="hidden text-rg-cream font-rg-serif text-sm tracking-wide sm:block">RevisionGrade&#8482;</span>
        </Link>

        <nav className="hidden min-w-0 items-center justify-between gap-4 xl:flex xl:flex-1 2xl:gap-6 xl:px-6">
          {isAuthed && <NavLink href="/dashboard">Dashboard</NavLink>}
          {isAuthed && <NavLink href="/manuscripts">Manuscripts</NavLink>}

          <NavLink href="/evaluate">Evaluate</NavLink>
          <div className="relative shrink-0" ref={reviseMenuRef}>
            <button
              type="button"
              onClick={() => { setReviseOpen((v) => !v); setResourcesOpen(false); setArpOpen(false); setSgOpen(false); }}
              className={reviseActiveHrefs.some(h => pathname.startsWith(h)) ? activeLinkCls : linkCls}
              aria-expanded={reviseOpen}
              aria-haspopup="menu"
              aria-controls="revise-menu"
            >
              Revise
            </button>
            {reviseOpen && (
              <div id="revise-menu" className={`${dropdownCls} w-52`} role="menu">
                {reviseLinks.map(([label, href]) => (
                  <Link key={href} href={href} role="menuitem" onClick={() => setReviseOpen(false)} className={dropdownItemCls}>
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {isAuthed ? (
            <div className="relative shrink-0" ref={arpMenuRef}>
              <button
                type="button"
                onClick={() => { setArpOpen((v) => !v); setResourcesOpen(false); setSgOpen(false); setReviseOpen(false); }}
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

          <div className="relative shrink-0" ref={sgMenuRef}>
            <button
              type="button"
              onClick={() => { setSgOpen((v) => !v); setArpOpen(false); setResourcesOpen(false); setReviseOpen(false); }}
              className="whitespace-nowrap font-rg-mono text-[0.8rem] font-semibold normal-case tracking-[0.02em] transition-colors duration-150 hover:opacity-90 xl:text-[0.86rem]"
              style={{ color: "#FF0000", textShadow: "0 0 6px rgba(255,0,0,0.4)" }}
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

          <div className="relative shrink-0" ref={resourcesMenuRef}>
            <button
              type="button"
              onClick={() => { setResourcesOpen((v) => !v); setArpOpen(false); setSgOpen(false); setReviseOpen(false); }}
              className={resourcesActive ? activeLinkCls : linkCls}
              aria-expanded={resourcesOpen}
              aria-haspopup="menu"
              aria-controls="resources-menu"
            >
              Resources
            </button>
            {resourcesOpen && (
              <div id="resources-menu" className={`${dropdownCls} w-72`} role="menu">
                {visibleResourceLinks.map(([label, href]) => (
                  href === "#admin-tools" ? (
                    <div key={href} className="mt-2 border-t border-rg-gold/25 px-3 pt-3 pb-1 font-rg-mono text-[10px] uppercase tracking-[0.16em] text-rg-gold/80">
                      Admin tools
                    </div>
                  ) : (
                    <Link key={href} href={href} role="menuitem" onClick={() => setResourcesOpen(false)} className={dropdownItemCls}>
                      {label}
                    </Link>
                  )
                ))}
              </div>
            )}
          </div>

          <NavLink href="/pricing">Pricing</NavLink>
        </nav>

        <div className="hidden shrink-0 xl:block">
          {authState === "loading" && (
            <span className="inline-block w-14 h-5 rounded bg-rg-cream2/10 animate-pulse" />
          )}
          {authState === "authed" && (
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              data-testid="nav-signout"
              className="whitespace-nowrap font-rg-mono text-[0.78rem] font-semibold normal-case tracking-[0.02em] text-rg-dim hover:text-rg-cream2 transition-colors duration-150 disabled:opacity-40"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          )}
          {authState === "anon" && (
            <Link
              href="/login"
              className="whitespace-nowrap font-rg-mono text-[0.78rem] font-semibold normal-case tracking-[0.02em] text-rg-cream2 hover:text-rg-gold transition-colors duration-150"
            >
              Sign in
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          className="inline-flex h-10 w-10 items-center justify-center border border-rg-cream2/15 text-rg-cream2 xl:hidden"
        >
          <span className="sr-only">Menu</span>
          ☰
        </button>
      </div>

      {mobileOpen && (
        <div id="mobile-nav" className="border-t border-rg-cream2/10 bg-rg-ink2 px-4 py-4 xl:hidden">
          <div className="space-y-2">
            {isAuthed && <MobileLink href="/dashboard">Dashboard</MobileLink>}
            {isAuthed && <MobileLink href="/manuscripts">Manuscripts</MobileLink>}
            <MobileLink href="/evaluate">Evaluate</MobileLink>
            <MobileLink href="/revise-queue">Revise Queue</MobileLink>
            <MobileLink href="/workbench-v2">Revise Workbench</MobileLink>
            <MobileLink href="/agent-readiness">Agent Readiness&#8482;</MobileLink>
            <MobileLink href="/storygate-studio">Storygate Studio&#8482;</MobileLink>
            <MobileLink href="/resources">Resources</MobileLink>
            <MobileLink href="/faq">Author FAQ</MobileLink>
            <MobileLink href="/pricing">Pricing</MobileLink>
            {isAuthed && isAdmin && <MobileLink href="/admin">Admin Control Center</MobileLink>}
            {isAuthed && (
              <button type="button" onClick={handleSignOut} disabled={signingOut} className={mobileLinkCls}>
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            )}
            {authState === "anon" && (
              <Link href="/login" className={mobileLinkCls}>Sign in</Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
