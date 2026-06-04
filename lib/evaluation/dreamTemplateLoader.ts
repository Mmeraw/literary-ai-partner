/**
 * DREAM Template Loader
 *
 * Reads the canonical DREAM evaluation template `.md` files from
 * `docs/templates/evaluation/` and provides them to the pipeline.
 *
 * Templates are read once and cached for the process lifetime.
 * If a file cannot be read (e.g. in a test environment), the loader
 * returns a built-in fallback so the pipeline never crashes.
 */

import { readFileSync } from "fs";
import { join } from "path";

export type DreamTemplateKey =
  | "short_form"
  | "long_form"
  | "long_form_multi_layer";

const TEMPLATE_DIR = join(
  process.cwd(),
  "docs",
  "templates",
  "evaluation",
);

const FILE_MAP: Record<DreamTemplateKey, string> = {
  short_form: "short-form-evaluation-template.md",
  long_form: "long-form-evaluation-template.md",
  long_form_multi_layer: "long-form-multi-layer-evaluation-template.md",
};

const cache = new Map<DreamTemplateKey, string>();

/**
 * Load a DREAM template by key. Returns the full markdown content.
 * Caches after first read; returns empty string on read failure.
 */
export function loadDreamTemplate(key: DreamTemplateKey): string {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const filePath = join(TEMPLATE_DIR, FILE_MAP[key]);
  try {
    const content = readFileSync(filePath, "utf-8");
    cache.set(key, content);
    return content;
  } catch {
    console.warn(
      `[DreamTemplateLoader] Could not read ${filePath} — using empty fallback`,
    );
    cache.set(key, "");
    return "";
  }
}

/**
 * Resolve the correct template key from word count.
 * <25,000 words → short_form
 * ≥25,000 words → long_form (standard; multi-layer is determined by
 * manuscript architecture, not word count alone — callers may override).
 */
export function resolveTemplateKey(
  wordCount?: number,
  isMultiLayer?: boolean,
): DreamTemplateKey {
  if (wordCount !== undefined && wordCount < 25_000) return "short_form";
  if (isMultiLayer) return "long_form_multi_layer";
  return "long_form";
}

/**
 * Build a compact prompt-ready version of a DREAM template.
 * Strips markdown formatting and extracts key section headings and rules
 * to keep the prompt injection within a reasonable token budget.
 */
export function buildCompactTemplateBlock(key: DreamTemplateKey): string {
  const raw = loadDreamTemplate(key);
  if (!raw) return "";

  // Extract section headings and their immediate content
  const lines = raw.split("\n");
  const sections: string[] = [];
  let currentSection = "";
  let lineCount = 0;
  const MAX_LINES_PER_SECTION = 12;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (currentSection) sections.push(currentSection.trim());
      currentSection = line + "\n";
      lineCount = 0;
    } else if (line.startsWith("# ")) {
      if (currentSection) sections.push(currentSection.trim());
      currentSection = line + "\n";
      lineCount = 0;
    } else if (currentSection && lineCount < MAX_LINES_PER_SECTION) {
      // Include content lines (skip empty markdown artifacts)
      const trimmed = line.replace(/^[|`-]+$/, "").trim();
      if (trimmed) {
        currentSection += trimmed + "\n";
        lineCount++;
      }
    }
  }
  if (currentSection) sections.push(currentSection.trim());

  const label = key === "short_form"
    ? "SHORT-FORM"
    : key === "long_form_multi_layer"
      ? "LONG-FORM MULTI-LAYER"
      : "LONG-FORM";

  return [
    `DREAM ${label} EVALUATION TEMPLATE (canonical report shape):`,
    "The evaluation output MUST follow this structure. Sections listed below are REQUIRED unless marked optional.",
    "",
    ...sections,
  ].join("\n");
}

/** Clear the template cache (for testing). */
export function clearTemplateCache(): void {
  cache.clear();
}
