"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function HeaderNav() {
  const pathname = usePathname() || "/";

  const isAppRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/evaluate") ||
    pathname.startsWith("/revise") ||
    pathname.startsWith("/convert") ||
    pathname.startsWith("/output") ||
    pathname.startsWith("/storygate");

  return (
    <header className="w-full bg-white border-b">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <span className="text-sm">RG</span>
          </span>
          <span>RevisionGrade™</span>
        </Link>

        {isAppRoute ? (
          <nav className="flex items-center gap-6 text-sm text-slate-700">
            <Link href="/dashboard" className="hover:text-slate-900">Dashboard</Link>
            <Link href="/evaluate" className="hover:text-slate-900">Evaluate</Link>
            <Link href="/revise" className="hover:text-slate-900">Revise</Link>
            <Link href="/convert" className="hover:text-slate-900">Convert</Link>
            <Link href="/output" className="hover:text-slate-900">Output</Link>

            <Link href="/storygate" className="font-semibold text-red-600 hover:text-red-700">
              Storygate Studio™
            </Link>

            <Link href="/resources" className="hover:text-slate-900">Resources</Link>
            <Link href="/pricing" className="hover:text-slate-900">Pricing</Link>
          </nav>
        ) : (
          <nav className="flex items-center gap-6 text-sm text-slate-700">
            <Link href="/#features" className="hover:text-slate-900">Features</Link>
            <Link href="/#wave" className="hover:text-slate-900">WAVE System</Link>
            <Link href="/#packages" className="hover:text-slate-900">Packages</Link>
            <Link href="/resources" className="hover:text-slate-900">Resources</Link>
            <Link href="/pricing" className="hover:text-slate-900">Pricing</Link>

            <Link
              href="/evaluate"
              className="ml-2 inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
            >
              Get Started →
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
