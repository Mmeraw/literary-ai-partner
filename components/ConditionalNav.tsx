"use client";
import { usePathname } from "next/navigation";
import HeaderNav from "./HeaderNav";

// Marketing routes render their own full-page HTML with a built-in nav
// so we suppress the shared HeaderNav on those routes
const MARKETING_ROUTES = ["/", "/revise", "/pricing", "/resources", "/workbench"];

export default function ConditionalNav() {
  const pathname = usePathname() || "/";
  const isMarketing = MARKETING_ROUTES.some(r => pathname === r || pathname === r + "/");
  if (isMarketing) return null;
  return <HeaderNav />;
}
