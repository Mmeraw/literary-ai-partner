"use client";

/**
 * HeaderNav — RevisionGrade canonical navigation shell
 *
 * Governed OS principle: core product actions stay top-level; reference pages
 * live behind Resources; auth state controls Dashboard vs Sign In/Sign Out.
 *
 * Auth states:
 *   authState = "loading"   — session check in-flight; render nav skeleton (no flash)
 *   authState = "authed"    — valid session; show Dashboard + optional Pipeline
 *   authState = "anon"      — no session; show Sign In
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isPipelineHealthAdminEmail } from "@/lib/admin/pipelineHealthAllowlist";

const resourceLinks = [
  ["The Black Box Problem", "/black-box-problem"],
  ["FAQs", "/resources"],
  ["Methodology", "/methodology"],
  ["Editorial Doctrine", "/reliability"],
];

const resourceActiveHrefs = [
  "/black-box-problem",
  "/resources",
  "/methodology",
  "/reliability",
];

export default function HeaderNav() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const resourcesMenuRef = useRef(null);

  // "loading" prevents the nav from flashing between authed/anon states on mount
  const [authState, setAuthState] = useState("loading"); // "loading" | "authed" | "anon"
  const [email, setEmail] = useState(null);
  const [signingOut, setSigningOut] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);

  const isAdmin = isPipelineHealthAdminEmail(email);
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
        if (!cancelled) {
          setEmail(null);
          setAuthState("anon");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (!resourcesOpen) return;

    function handlePointerDown(event) {
      if (!resourcesMenuRef.current) return;
      if (!resourcesMenuRef.current.contains(event.target)) {
        setResourcesOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setResourcesOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [resourcesOpen]);

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
    setAuthState("anon");
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

  const resourcesActive = resourceActiveHrefs.some(
    (href) => pathname === href || pathname.startsWith(`${href}/`)
  );

  return (
    <header className="w-full bg-rg-ink border-b border-rg-cream2/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-8">
        <Link href="/" className="flex items-center gap-3 shrink-0 group">
          <span className="inline-flex h-8 w-8 items-center justify-center border border-rg-gold/60 text-rg-gold font-rg-serif text-sm group-hover:border-rg-gold transition-colors duration-150">
            R
          </span>
          <span className="text-rg-cream font-rg-serif text-sm tracking-wide hidden sm:block">
            RevisionGrade&#8482;
          </span>
        </Link>

        <nav className="flex items-center gap-6 flex-1 justify-center">
          <NavLink href="/evaluate">Evaluate</NavLink>
          <NavLink href="/revise">Revise</NavLink>
          <NavLink href="/reliability">Reliability</NavLink>
          <div className="relative" ref={resourcesMenuRef}>
            <button
              type="button"
              onClick={() => setResourcesOpen((value) => !value)}
              className={resourcesActive ? activeLinkCls : linkCls}
              aria-expanded={resourcesOpen}
              aria-haspopup="menu"
              aria-controls="resources-menu"
            >
              Resources
            </button>
            {resourcesOpen && (
              <div
                id="resources-menu"
                className="absolute left-1/2 top-8 z-50 w-56 -translate-x-1/2 border border-rg-cream2/15 bg-rg-ink2 p-3 shadow-xl shadow-black/30"
                role="menu"
              >
                {resourceLinks.map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    role="menuitem"
                    onClick={() => setResourcesOpen(false)}
                    className="block px-3 py-2 font-rg-mono text-xs uppercase tracking-[0.14em] text-rg-cream2 hover:text-rg-cream"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <NavLink href="/pricing">Pricing</NavLink>

          {/* Auth-gated items — only render once auth check resolves (no flash) */}
          {isAuthed && <NavLink href="/dashboard">Dashboard</NavLink>}
          {isAuthed && isAdmin && (
            <NavLink href="/admin/pipeline-health">Pipeline</NavLink>
          )}
        </nav>

        <div className="shrink-0">
          {/* While loading: render a ghost placeholder to prevent layout shift */}
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
            <Link
              href="/login"
              data-testid="nav-signin"
              className="text-xs tracking-widest uppercase font-rg-mono border border-rg-gold text-rg-gold px-3 py-1.5 hover:bg-rg-gold hover:text-rg-ink transition-colors duration-150"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
