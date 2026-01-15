// src/components/HeaderNav.jsx
import Link from "next/link";

const NAV = [
  {
    label: "Evaluate",
    href: "/evaluate",
  },
  {
    label: "Revise",
    href: "/revise",
  },
  {
    label: "Convert",
    href: "/convert",
  },
  {
    label: "Output",
    href: "/outputs",
  },
  {
    label: "StoryGate Studio",
    href: "/storygate",
  },
  {
    label: "Resources",
    href: "/resources",
  },
  {
    label: "Pricing",
    href: "/pricing",
  },
  {
    label: "Sign in",
    href: "/signin",
  },
];

export default function HeaderNav() {
  return (
    <header className="w-full border-b bg-white">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="font-semibold text-lg">RevisionGrade™</div>
        <div className="flex flex-wrap gap-4 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hover:underline"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
