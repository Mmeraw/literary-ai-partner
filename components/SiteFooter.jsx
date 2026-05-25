import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white px-6 py-5 text-gray-600">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 text-xs md:flex-row md:items-center md:justify-between">
        <span>RevisionGrade. All rights reserved.</span>
        <div className="flex gap-4">
          <Link href="/privacy" className="transition hover:text-gray-900">Privacy</Link>
          <Link href="/terms" className="transition hover:text-gray-900">Terms</Link>
        </div>
      </div>
    </footer>
  );
}
