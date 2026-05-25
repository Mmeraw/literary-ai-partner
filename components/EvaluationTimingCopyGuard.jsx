"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const SHORT_FORM_COPY = "This typically takes 3–8 minutes.";
const LONG_FORM_COPY =
  "For long-form manuscripts, this stage can take 20–60 minutes depending on manuscript length, queue depth, and worker load.";

export default function EvaluationTimingCopyGuard() {
  const pathname = usePathname() || "/";

  useEffect(() => {
    if (!pathname.startsWith("/evaluate/")) return;
    if (typeof document === "undefined") return;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();

    while (node) {
      if (node.nodeValue && node.nodeValue.includes(SHORT_FORM_COPY)) {
        node.nodeValue = node.nodeValue.replace(SHORT_FORM_COPY, LONG_FORM_COPY);
      }
      node = walker.nextNode();
    }
  }, [pathname]);

  return null;
}
