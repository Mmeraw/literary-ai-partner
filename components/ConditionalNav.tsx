"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import HeaderNav from "./HeaderNav";

// Marketing routes are self-contained full HTML pages.
// Client-side SPA transitions break them — force a hard reload instead.
const MARKETING_ROUTES = ["/", "/revise", "/pricing", "/resources", "/workbench", "/analytics"];

function isMarketing(path: string) {
  return MARKETING_ROUTES.some(r => path === r || path === r + "/");
}

export default function ConditionalNav() {
  const pathname = usePathname() || "/";

  useEffect(() => {
    // Intercept all clicks on <a> tags that point to marketing routes
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;
      // Only intercept same-origin marketing route links
      try {
        const url = new URL(href, window.location.origin);
        if (url.origin === window.location.origin && isMarketing(url.pathname)) {
          // If we're currently on a marketing page navigating to another marketing page,
          // or from an app page to a marketing page — force hard navigation
          e.preventDefault();
          window.location.href = url.href;
        }
      } catch {
        // relative links handled above via getAttribute
        if (isMarketing(href)) {
          e.preventDefault();
          window.location.href = href;
        }
      }
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  if (isMarketing(pathname)) return null;
  return <HeaderNav />;
}
