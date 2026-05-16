"use client";

/**
 * HeaderNav — RevisionGrade canonical navigation shell
 *
 * Design language: dark editorial (rg-ink background, rg-cream text, rg-gold accents).
 * Matches the landing page design system.
 *
 * Launch-scope nav items (29-day sprint):
 *   App routes:    Dashboard · Evaluate · Revise · Resources · Pricing
 *   Marketing:     Evaluate · Revise · Resources · Pricing
 *   Both:          Sign In / Sign Out · Pipeline Health (admin only)
 *
 * Dropped from scope: Convert · Output · Storygate Studio
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isPipelineHealthAdminEmail } from "@/lib/admin/pipelineHealthAllowlist";

export default function HeaderNav() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [email, setEmail] = useState(null);
  const [signingOut, setSigningOut] = useState(false);

  const isAppRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/evaluate") ||
    pathname.startsWith("/revise") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/reports");

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

  // ── Shared link style ───────────────────────────────────────────────────────
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

  // ── Auth element ────────────────────────────────────────────────────────────
  const authEl = isAuthed ? (
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
    <Link
      href="/login"
      data-testid="nav-signin"
      className="text-xs tracking-widest uppercase font-rg-mono border border-rg-cream2/40 text-rg-cream px-3 py-1.5 hover:border-rg-gold hover:text-rg-gold transition-colors duration-150"
    >
      Sign in
    </Link>
  );

  return (
    <header className="w-full bg-rg-ink border-b border-rg-cream2/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-8">

        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-3 shrink-0 group"
        >
          {/* Monogram mark */}
          <span className="inline-flex h-8 w-8 items-center justify-center border border-rg-gold/60 text-rg-gold font-rg-serif text-sm group-hover:border-rg-gold transition-colors duration-150">
            R
          </span>
          <span className="text-rg-cream font-rg-serif text-sm tracking-wide hidden sm:block">
            RevisionGrade&#8482;
          </span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-6 flex-1 justify-center">
          {isAppRoute ? (
            <>
              <NavLink href="/dashboard">Dashboard</NavLink>
              <NavLink href="/evaluate">Evaluate</NavLink>
              <NavLink href="/revise">Revise</NavLink>
              <NavLink href="/resources">Resources</NavLink>
              <NavLink href="/pricing">Pricing</NavLink>
              {isAdmin && (
                <NavLink href="/admin/pipeline-health">Pipeline</NavLink>
              )}
            </>
          ) : (
            <>
              <NavLink href="/evaluate">Evaluate</NavLink>
              <NavLink href="/revise">Revise</NavLink>
              <NavLink href="/resources">Resources</NavLink>
              <NavLink href="/pricing">Pricing</NavLink>
              {isAdmin && (
                <NavLink href="/admin/pipeline-health">Pipeline</NavLink>
              )}
            </>
          )}
        </nav>

        {/* Auth */}
        <div className="shrink-0">
          {authEl}
        </div>

      </div>
    </header>
  );
}
