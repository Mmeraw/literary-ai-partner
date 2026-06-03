const ALLOWED_EVENT_NAMES = new Set([
  "page_view",
  "session_start",
  "session_heartbeat",
  "session_end",
  "route_change",
  "cta_click",
  "link_click",
  "external_link_click",
  "download_click",
  "pricing_view",
  "signup_click",
  "login_click",
  "private_beta_gate_view",
  "revise_dashboard_viewed",
  "revise_example_viewed",
  "revise_example_started",
  "revise_example_filter_used",
  "revise_example_item_opened",
  "revise_example_option_selected",
  "revise_example_accept_clicked",
  "revise_example_reject_clicked",
  "revise_example_custom_revision_clicked",
  "revise_example_copy_clicked",
  "revise_example_completed",
  "revise_example_abandoned",
  "evaluate_page_viewed",
  "evaluation_upload_started",
  "evaluation_upload_completed",
  "evaluation_job_created",
  "evaluation_report_viewed",
  "word_download_clicked",
  "pdf_download_clicked",
  "agent_readiness_viewed",
]);

const ALLOWED_METADATA_KEYS = new Set([
  "href",
  "host",
  "tag",
  "id",
  "testid",
  "analytics",
  "ariaLabel",
  "targetPath",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "range",
  "source",
  "section",
  "funnelStep",
]);

function cleanString(value: unknown, max = 256): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, max);
}

export function sanitizeEventName(value: unknown): string {
  const raw = cleanString(value, 96);
  if (!raw) return "page_view";
  const candidate = raw.toLowerCase().split("").map((ch) => /[a-z0-9_:-]/.test(ch) ? ch : "_").join("");
  return ALLOWED_EVENT_NAMES.has(candidate) ? candidate : "custom_event";
}

export function sanitizePath(value: unknown): string {
  const path = cleanString(value, 2048) ?? "/";
  return path.startsWith("/") ? path : "/";
}

export function sanitizeTarget(value: unknown): string | null {
  return cleanString(value, 160);
}

export function sanitizePageTitle(value: unknown): string | null {
  return cleanString(value, 180);
}

export function sanitizeDurationMs(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(Math.round(value), 43200000));
}

export function sanitizeMetadata(value: unknown): Record<string, string | number | boolean | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output: Record<string, string | number | boolean | null> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!ALLOWED_METADATA_KEYS.has(key)) continue;
    if (typeof raw === "string") output[key] = cleanString(raw, 256);
    else if (typeof raw === "number" && Number.isFinite(raw)) output[key] = raw;
    else if (typeof raw === "boolean") output[key] = raw;
    else if (raw === null) output[key] = null;
  }
  return output;
}

export function isLikelyBot(userAgent: string | null): boolean {
  const ua = (userAgent ?? "").toLowerCase();
  return ["bot", "crawler", "spider", "preview", "slurp", "headless", "monitor", "uptime", "lighthouse", "pagespeed"].some((token) => ua.includes(token));
}

export function inferDevice(userAgent: string | null): { deviceType: string; browser: string; os: string } {
  const ua = userAgent ?? "";
  const lower = ua.toLowerCase();
  const deviceType = lower.includes("mobile") || lower.includes("iphone") || lower.includes("android") ? "mobile" : lower.includes("ipad") || lower.includes("tablet") ? "tablet" : "desktop";
  const browser = lower.includes("edg/") ? "Edge" : lower.includes("chrome/") ? "Chrome" : lower.includes("safari/") ? "Safari" : lower.includes("firefox/") ? "Firefox" : "Unknown";
  const os = lower.includes("windows") ? "Windows" : lower.includes("mac os") || lower.includes("macintosh") ? "macOS" : lower.includes("android") ? "Android" : lower.includes("iphone") || lower.includes("ipad") ? "iOS" : lower.includes("linux") ? "Linux" : "Unknown";
  return { deviceType, browser, os };
}
