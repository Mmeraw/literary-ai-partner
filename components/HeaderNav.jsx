"use client";

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
    pathname.startsWith("/convert") ||
    pathname.startsWith("/output") ||
    pathname.startsWith("/storygate") ||
    pathname.startsWith("/admin");

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
    return () => {
      cancelled = true;
    };
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

  const authButton = isAuthed ? (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={signingOut}
      data-testid="nav-signout"
      className="ml-2 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50"
    >
      {signingOut ? "Signing out..." : "Sign out"}
    </button>
  ) : (
    <Link
      href="/login"
      data-testid="nav-signin"
      className="ml-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
    >
      Sign in
    </Link>
  );

  return (
    <header className="w-full bg-white border-b">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <span className="text-sm">RG</span>
          </span>
          <span>RevisionGrade&#8482;</span>
        </Link>

        {isAppRoute ? (
          <nav className="flex items-center gap-6 text-sm text-slate-700">
            <Link href="/dashboard" className="hover:text-slate-900">Dashboard</Link>
            <Link href="/evaluate" className="hover:text-slate-900">Evaluate</Link>
            <Link href="/revise" className="hover:text-slate-900">Revise</Link>
            <Link href="/convert" className="hover:text-slate-900">Convert</Link>
            <Link href="/output" className="hover:text-slate-900">Output</Link>
            <Link href="/storygate" className="font-semibold text-red-600 hover:text-red-700">Storygate Studio&#8482;</Link>
            <Link href="/resources" className="hover:text-slate-900">Resources</Link>
            <Link href="/pricing" className="hover:text-slate-900">Pricing</Link>
            {isAdmin && (
              <Link href="/admin/pipeline-health" className="font-semibold text-indigo-600 hover:text-indigo-700" data-testid="nav-pipeline-health">
                Pipeline Health
              </Link>
            )}
            {authButton}
          </nav>
        ) : (
          <nav className="flex items-center gap-6 text-sm text-slate-700">
            <Link href="/#features" className="hover:text-slate-900">Features</Link>
            <Link href="/#wave" className="hover:text-slate-900">WAVE System</Link>
            <Link href="/#packages" className="hover:text-slate-900">Packages</Link>
            <Link href="/resources" className="hover:text-slate-900">Resources</Link>
            <Link href="/pricing" className="hover:text-slate-900">Pricing</Link>
            {isAdmin && (
              <Link href="/admin/pipeline-health" className="font-semibold text-indigo-600 hover:text-indigo-700" data-testid="nav-pipeline-health">
                Pipeline Health
              </Link>
            )}
            <Link href="/evaluate" className="ml-2 inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">
              Get Started &rarr;
            </Link>
            {authButton}
          </nav>
        )}
      </div>
    </header>
  );
}
