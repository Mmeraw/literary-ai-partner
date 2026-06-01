import mammoth from "mammoth";

type SupabaseLike = {
  from: (table: string) => any;
};

function isDocxMime(mime: string | null | undefined): boolean {
  return (mime ?? "").toLowerCase().includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
}

function looksLikeDocxUrl(fileUrl: string): boolean {
  return /\.docx(?:[?#].*)?$/i.test(fileUrl) || isDocxMime(fileUrl.match(/^data:([^;,]+)/)?.[1]);
}

async function extractDocxText(buffer: Buffer): Promise<string | null> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || null;
  } catch {
    return null;
  }
}

async function decodeDataUrl(fileUrl: string): Promise<string | null> {
  const match = fileUrl.match(/^data:([^;,]*)(;base64)?,(.*)$/);
  if (!match) return null;

  const mime = match[1] ?? "";
  const isBase64 = Boolean(match[2]);
  const body = match[3] ?? "";
  const buffer = isBase64 ? Buffer.from(body, "base64") : Buffer.from(decodeURIComponent(body), "utf8");

  if (isDocxMime(mime)) return extractDocxText(buffer);
  return buffer.toString("utf8");
}

async function resolveTextFromFileUrl(fileUrl: string | null | undefined): Promise<string | null> {
  if (!fileUrl) return null;
  if (fileUrl.startsWith("data:")) return decodeDataUrl(fileUrl);

  try {
    const response = await fetch(fileUrl);
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (isDocxMime(contentType) || looksLikeDocxUrl(fileUrl)) {
      return extractDocxText(Buffer.from(await response.arrayBuffer()));
    }

    return await response.text();
  } catch {
    return null;
  }
}

export function normalizeFinalReviewText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim();
}

export function isLikelyInternalReport(value: string | null | undefined): boolean {
  const text = normalizeFinalReviewText(value);
  if (!text) return false;

  const needles = [
    "Evaluation Job ID",
    "Job Status",
    "Report ready",
    "CONFIDENCE VARIES ACROSS THIS REPORT",
    "Overall Summary",
    "Top Recommendations",
    "Evaluation Provenance",
    "Score Ledger",
    "Chunks Analyzed",
    "Successfully Processed",
    "Prompt Version",
  ];

  const hits = needles.filter((needle) => text.toLowerCase().includes(needle.toLowerCase())).length;
  return hits >= 2;
}

export function scrubInternalReportLeakage(value: string | null | undefined): string {
  const text = normalizeFinalReviewText(value);
  if (!text) return "";
  if (isLikelyInternalReport(text)) return "";

  return text
    .split(/\n/g)
    .filter((line) => !/\b(Evaluation Job ID|Job Status|Report ready|Word Count|Created|Updated|Generated|CONFIDENCE VARIES ACROSS THIS REPORT|Evaluation Provenance|Score Ledger|Chunks? Analyzed|Successfully Processed|Engine:|Provider:|Prompt Version|gpt-|openai|sampled prompt window|compressed manuscript reference window|too few chunks)\b/i.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function sourceFromVersionRelation(supabase: SupabaseLike, sourceVersionId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("manuscript_versions")
    .select("id, raw_text, manuscripts(file_url)")
    .eq("id", sourceVersionId)
    .maybeSingle();

  if (error || !data) return null;

  const rawText = normalizeFinalReviewText((data as { raw_text?: string | null }).raw_text);
  if (rawText && !isLikelyInternalReport(rawText)) return rawText;

  const manuscripts = (data as { manuscripts?: unknown }).manuscripts;
  const manuscript = Array.isArray(manuscripts) ? manuscripts[0] : manuscripts as { file_url?: string | null } | null | undefined;
  const resolved = normalizeFinalReviewText(await resolveTextFromFileUrl(manuscript?.file_url));

  if (resolved && !isLikelyInternalReport(resolved)) return resolved;
  return null;
}

async function sourceFromManuscriptFile(supabase: SupabaseLike, manuscriptId: number, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("manuscripts")
    .select("id, user_id, file_url")
    .eq("id", manuscriptId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  const resolved = normalizeFinalReviewText(await resolveTextFromFileUrl((data as { file_url?: string | null }).file_url));
  if (resolved && !isLikelyInternalReport(resolved)) return resolved;
  return null;
}

export function buildDecisionOnlyPreview(input: {
  manuscriptTitle: string;
  decisions: Array<{
    decision: string;
    selected_text: string | null;
    custom_text: string | null;
    source_excerpt: string | null;
    opportunity_title: string;
  }>;
}): string {
  const lines = [
    `${input.manuscriptTitle}`,
    "",
    "Revision preview reconstructed from accepted ledger decisions because the original manuscript file could not be read.",
    "",
  ];

  for (const decision of input.decisions) {
    if (!["accepted_a", "accepted_b", "accepted_c", "custom", "keep_original"].includes(decision.decision)) continue;
    const selected = scrubInternalReportLeakage(decision.decision === "custom" ? decision.custom_text : decision.selected_text);
    const source = scrubInternalReportLeakage(decision.source_excerpt);

    lines.push(decision.opportunity_title);
    if (decision.decision === "keep_original") {
      lines.push(source || "Kept original.");
    } else {
      lines.push(selected || source || "No replacement text was available.");
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

export async function resolveFinalReviewSourceText(input: {
  supabase: SupabaseLike;
  manuscriptId: number;
  userId: string;
  sourceVersionId: string;
  fallbackRawText?: string | null;
}): Promise<string> {
  const fallback = normalizeFinalReviewText(input.fallbackRawText);
  if (fallback && !isLikelyInternalReport(fallback)) return fallback;

  const fromVersion = await sourceFromVersionRelation(input.supabase, input.sourceVersionId);
  if (fromVersion) return fromVersion;

  const fromManuscript = await sourceFromManuscriptFile(input.supabase, input.manuscriptId, input.userId);
  if (fromManuscript) return fromManuscript;

  return "";
}
