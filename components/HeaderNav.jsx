"use client";

/**
 * HeaderNav — RevisionGrade canonical navigation shell
 *
 * Governed OS principle: core product actions stay top-level; reference pages
 * live behind Resources; auth state controls Dashboard vs Sign In/Sign Out.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isPipelineHealthAdminEmail } from "@/lib/admin/pipelineHealthAllowlist";

const resourceLinks = [
  ["FAQs", "/resources"],
  ["Methodology", "/methodology"],
  ["Editorial Doctrine", "/reliability"],
];

export default function HeaderNav() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [email, setEmail] = useState(null);
  const [signingOut, setSigningOut] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);

  const isAdmin = isPipelineHealthAdminEmail(email);
  const isAuthed = !!email;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/user", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        setEmail((data && data.user && data.user.email) || null);
      })
      .catch(() => {
        if (!cancelled) setEmail(null);
      });
    return () => { cancelled = true; };
  }, [pathname]);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch("/api/auth/signout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
    } catch {
      // best-effort
    }
    setEmail(null);
    router.push("/");
    router.refresh();
    setSigningOut(false);
  }

  const linkCls =
    "text-xs tracking-widest uppercase font-rg-mono text-rg-cream2 hover:text-rg-cream transition-colors duration-150";
  const activeLinkCls =
    "text-xs tracking-widest uppercase font-rg-mono text-rg-gold";

  function NavLink({ href, children }) {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link href={href} className={active ? activeLinkCls : linkCls}>
        {children}
      </Link>
    );
  }

  const resourcesActive = resourceLinks.some(([, href]) => pathname === href || pathname.startsWith(`${href}/`));

  return (
    <header className="w-full bg-rg-ink border-b border-rg-cream2/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-8">
        <Link href="/" className="flex items-center gap-3 shrink-0 group">
          <span className="inline-flex h-8 w-8 items-center justify-center border border-rg-gold/60 text-rg-gold font-rg-serif text-sm group-hover:border-rg-gold transition-colors duration-150">R</span>
          <span className="text-rg-cream font-rg-serif text-sm tracking-wide hidden sm:block">RevisionGrade&#8482;</span>
        </Link>

        <nav className="flex items-center gap-6 flex-1 justify-center">
          <NavLink href="/evaluate">Evaluate</NavLink>
          <NavLink href="/revise">Revise</NavLink>
          <NavLink href="/reliability">Reliability</NavLink>
          <div className="relative">
            <button
              type="button"
              onClick={() => setResourcesOpen((value) => !value)}
              onBlur={() => window.setTimeout(() => setResourcesOpen(false), 120)}
              className={resourcesActive ? activeLinkCls : linkCls}
              aria-expanded={resourcesOpen}
              aria-haspopup="menu"
            >
              Resources
            </button>
            {resourcesOpen && (
              <div className="absolute left-1/2 top-8 z-50 w-56 -translate-x-1/2 border border-rg-cream2/15 bg-rg-ink2 p-3 shadow-xl shadow-black/30" role="menu">
                {resourceLinks.map(([label, href]) => (
                  <Link key={href} href={href} role="menuitem" className="block px-3 py-2 font-rg-mono text-xs uppercase tracking-[0.14em] text-rg-cream2 hover:text-rg-cream">
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <NavLink href="/pricing">Pricing</NavLink>
          {isAuthed && <NavLink href="/dashboard">Dashboard</NavLink>}
          {isAdmin && <NavLink href="/admin/pipeline-health">Pipeline</NavLink>}
        </nav>

        <div className="shrink-0">
          {isAuthed ? (
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              data-testid="nav-signout"
              className="text-xs tracking-widest uppercase font-rg-mono text-rg-dim hover:text-rg-cream2 transition-colors duration-150 disabled:opacity-40"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          ) : (
            <Link href="/login" data-testid="nav-signin" className="text-xs tracking-widest uppercase font-rg-mono border border-rg-gold text-rg-gold px-3 py-1.5 hover:bg-rg-gold hover:text-rg-ink transition-colors duration-150">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
