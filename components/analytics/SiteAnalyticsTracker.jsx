"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const ANON_KEY = "rg_anon_id";
const SESSION_KEY = "rg_session_id";

function getAnonId() {
  try {
    const existing = localStorage.getItem(ANON_KEY);
    if (existing) return existing;
    const next = `rg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(ANON_KEY, next);
    return next;
  } catch {
    return `rg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

async function track(eventName, extra = {}) {
  try {
    const response = await fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify({
        anonymousId: getAnonId(),
        sessionId: sessionStorage.getItem(SESSION_KEY),
        eventName,
        path: window.location.pathname + window.location.search,
        pageTitle: document.title,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...extra,
      }),
    });
    const json = await response.json().catch(() => null);
    if (json?.sessionId) sessionStorage.setItem(SESSION_KEY, json.sessionId);
  } catch {
    // Analytics must never block the product.
  }
}

function pageSpecificEvent(pathname) {
  if (pathname === "/evaluate") return "evaluate_page_viewed";
  if (pathname.startsWith("/agent-readiness")) return "agent_readiness_viewed";
  if (pathname.startsWith("/revise")) return "revise_dashboard_viewed";
  if (pathname.includes("workbench")) return "revise_example_viewed";
  return null;
}

function clickEventFromElement(element) {
  const clickable = element?.closest?.("a,button");
  if (!clickable) return null;
  const href = clickable.getAttribute("href") || "";
  const label = clickable.getAttribute("data-analytics") || clickable.getAttribute("data-testid") || clickable.getAttribute("aria-label") || clickable.textContent?.trim()?.slice(0, 80) || clickable.tagName;
  let eventName = "link_click";
  const signal = `${href} ${label}`.toLowerCase();
  if (signal.includes("download") || signal.includes("pdf") || signal.includes("word") || signal.includes("docx")) eventName = "download_click";
  if (signal.includes("pricing")) eventName = "pricing_view";
  if (signal.includes("login") || signal.includes("sign in")) eventName = "login_click";
  if (signal.includes("evaluate") || signal.includes("get revisiongraded") || signal.includes("start")) eventName = "cta_click";
  if (signal.includes("workbench") || signal.includes("revise example") || signal.includes("repair queue")) eventName = "revise_example_started";
  return { eventName, target: label, metadata: { href, tag: clickable.tagName.toLowerCase() } };
}

export default function SiteAnalyticsTracker() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const pageStartedAt = useRef(Date.now());
  const lastPath = useRef(null);

  useEffect(() => {
    track("session_start", { landingPath: window.location.pathname + window.location.search, referrer: document.referrer || null });
    const end = () => track("session_end", { durationMs: Date.now() - pageStartedAt.current });
    window.addEventListener("beforeunload", end);
    return () => window.removeEventListener("beforeunload", end);
  }, []);

  useEffect(() => {
    const fullPath = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
    if (lastPath.current === fullPath) return;
    const previousStartedAt = pageStartedAt.current;
    pageStartedAt.current = Date.now();
    lastPath.current = fullPath;
    track("page_view", { path: fullPath, durationMs: Date.now() - previousStartedAt });
    const specific = pageSpecificEvent(pathname);
    if (specific) track(specific, { path: fullPath });
  }, [pathname, searchParams]);

  useEffect(() => {
    const handler = (event) => {
      // Capture target synchronously (the element may be gone after the timeout),
      // then yield to the browser before doing any analytics work so the click
      // interaction can paint without being blocked by DOM traversal + fetch.
      const target = event.target;
      window.setTimeout(() => {
        const inferred = clickEventFromElement(target);
        if (inferred) track(inferred.eventName, inferred);
      }, 0);
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => track("session_heartbeat", { durationMs: Date.now() - pageStartedAt.current }), 30000);
    return () => window.clearInterval(interval);
  }, []);

  return null;
}
