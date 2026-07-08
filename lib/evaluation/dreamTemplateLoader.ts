/**
 * DREAM Template Loader
 *
 * Reads the canonical DREAM evaluation, cognitive initialization, and Story Ledger
 * template `.md` files and provides them to the pipeline.
 *
 * Templates are read once and cached for the process lifetime.
 * If a file cannot be read (e.g. in a test environment), the loader
 * returns a built-in fallback so the pipeline never crashes.
 *
 * Canonical template locations:
 *   - DREAM Cognitive Initialization Protocol: docs/governance/DREAM-COGNITIVE-INITIALIZATION-PROTOCOL-V1.md
 *     (legacy fallback: docs/governance/dream-cognitive-initialization-protocol.md)
 *   - DREAM evaluation: docs/templates/evaluation/*.md
 *   - Story Ledger template: docs/benchmarks/story-ledger/STORY_LEDGER_10_LAYER_TEMPLATE.md
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

const CONSTITUTIONAL_AUTHORITY_REGISTRY_PATH = join(
  process.cwd(),
  "docs",
  "governance",
  "CONSTITUTIONAL_AUTHORITY_REGISTRY.md",
);

const COGNITIVE_INITIALIZATION_PROTOCOL_PATH = join(
  process.cwd(),
  "docs",
  "governance",
  "DREAM-COGNITIVE-INITIALIZATION-PROTOCOL-V1.md",
);

const LEGACY_COGNITIVE_INITIALIZATION_PROTOCOL_PATH = join(
  process.cwd(),
  "docs",
  "governance",
  "dream-cognitive-initialization-protocol.md",
);

const STORY_LEDGER_TEMPLATE_PATH = join(
  process.cwd(),
  "docs",
  "benchmarks",
  "story-ledger",
  "STORY_LEDGER_10_LAYER_TEMPLATE.md",
);

const FILE_MAP: Record<DreamTemplateKey, string> = {
  short_form: "short-form-evaluation-template.md",
  long_form: "long-form-multi-layer-evaluation-template.md",
  long_form_multi_layer: "long-form-multi-layer-evaluation-template.md",
};

const cache = new Map<string, string>();

export type ConstitutionalAuthorityBinding = "binding" | "template" | "calibration" | "reference";

export type ConstitutionalAuthorityEntry = {
  authorityId: string;
  level: 1 | 2 | 3;
  required: boolean;
  runtimeBinding: ConstitutionalAuthorityBinding;
  path: string;
};

const FALLBACK_CONSTITUTIONAL_AUTHORITIES: ConstitutionalAuthorityEntry[] = [
  {
    authorityId: "DCIP",
    level: 1,
    required: true,
    runtimeBinding: "binding",
    path: "docs/governance/DREAM-COGNITIVE-INITIALIZATION-PROTOCOL-V1.md",
  },
  {
    authorityId: "EVALUATION_TEMPLATE_LONG_FORM_MULTI_LAYER",
    level: 1,
    required: true,
    runtimeBinding: "template",
    path: "docs/templates/evaluation/long-form-multi-layer-evaluation-template.md",
  },
  {
    authorityId: "EVALUATION_RENDERING_CONTRACT",
    level: 1,
    required: true,
    runtimeBinding: "binding",
    path: "docs/templates/evaluation/evaluation-rendering-contract.md",
  },
  {
    authorityId: "EVALUATION_OUTPUT_MODE_CONTRACT",
    level: 1,
    required: true,
    runtimeBinding: "binding",
    path: "docs/governance/evaluation-output-mode-contract.md",
  },
  {
    authorityId: "STORY_LEDGER_TEMPLATE",
    level: 2,
    required: true,
    runtimeBinding: "binding",
    path: "docs/benchmarks/story-ledger/STORY_LEDGER_10_LAYER_TEMPLATE.md",
  },
  {
    authorityId: "RUNTIME_BENCHMARK_AUTHORITY_MAP",
    level: 3,
    required: true,
    runtimeBinding: "calibration",
    path: "docs/benchmarks/RUNTIME_BENCHMARK_AUTHORITY_MAP.md",
  },
  {
    authorityId: "DREAM_LONGFORM_BENCHMARK_INDEX",
    level: 3,
    required: true,
    runtimeBinding: "calibration",
    path: "docs/benchmarks/DREAM_LONGFORM_BENCHMARK_INDEX.md",
  },
];

/**
 * Load any template file by absolute path. Caches after first read.
 */
function loadTemplateFile(filePath: string, cacheKey: string): string {
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const content = readFileSync(filePath, "utf-8");
    cache.set(cacheKey, content);
    return content;
  } catch {
    console.warn(
      `[DreamTemplateLoader] Could not read ${filePath} — using empty fallback`,
    );
    cache.set(cacheKey, "");
    return "";
  }
}

function parseBoolean(value: string): boolean {
  return value.trim().toLowerCase() === "true";
}

function parseBinding(value: string): ConstitutionalAuthorityBinding {
  const normalized = value.trim().toLowerCase();
  if (normalized === "binding" || normalized === "template" || normalized === "calibration" || normalized === "reference") {
    return normalized;
  }
  return "reference";
}

function parseLevel(value: string): 1 | 2 | 3 | null {
  const n = Number(value.trim());
  if (n === 1 || n === 2 || n === 3) return n;
  return null;
}

export function loadConstitutionalAuthorityRegistry(): ConstitutionalAuthorityEntry[] {
  const raw = loadTemplateFile(
    CONSTITUTIONAL_AUTHORITY_REGISTRY_PATH,
    "governance:constitutional_authority_registry",
  );

  if (!raw.trim()) return FALLBACK_CONSTITUTIONAL_AUTHORITIES;

  const parsed: ConstitutionalAuthorityEntry[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("|")) continue;

    const parts = trimmed.split("|").map((p) => p.trim());
    if (parts.length !== 5) continue;
    const [authorityId, levelRaw, requiredRaw, runtimeBindingRaw, pathRaw] = parts;
    const level = parseLevel(levelRaw);
    if (!authorityId || !level || !pathRaw) continue;

    parsed.push({
      authorityId,
      level,
      required: parseBoolean(requiredRaw),
      runtimeBinding: parseBinding(runtimeBindingRaw),
      path: pathRaw,
    });
  }

  return parsed.length > 0 ? parsed : FALLBACK_CONSTITUTIONAL_AUTHORITIES;
}

export function getConstitutionalAuthorityEntry(authorityId: string): ConstitutionalAuthorityEntry | null {
  const entry = loadConstitutionalAuthorityRegistry().find((e) => e.authorityId === authorityId);
  return entry ?? null;
}

export function getConstitutionalAuthorityStatus(): {
  registryPath: string;
  entries: ConstitutionalAuthorityEntry[];
  missingRequiredAuthorities: string[];
  loadedRequiredAuthorities: string[];
  status: "pass" | "fail";
} {
  const entries = loadConstitutionalAuthorityRegistry();
  const missingRequiredAuthorities: string[] = [];
  const loadedRequiredAuthorities: string[] = [];

  for (const entry of entries) {
    if (!entry.required) continue;
    const content = loadTemplateFile(join(process.cwd(), entry.path), `governance:authority:${entry.authorityId}`);
    if (!content.trim()) {
      missingRequiredAuthorities.push(entry.authorityId);
    } else {
      loadedRequiredAuthorities.push(entry.authorityId);
    }
  }

  return {
    registryPath: "docs/governance/CONSTITUTIONAL_AUTHORITY_REGISTRY.md",
    entries,
    missingRequiredAuthorities,
    loadedRequiredAuthorities,
    status: missingRequiredAuthorities.length === 0 ? "pass" : "fail",
  };
}

/**
 * Load the DREAM Cognitive Initialization Protocol. Returns the full markdown
 * content. This is constitutional reasoning authority for DREAM-compatible
 * evaluation, revise, queue, and certification stages.
 */
export function loadDreamCognitiveInitializationProtocol(): string {
  const dcipAuthority = getConstitutionalAuthorityEntry("DCIP");
  const dcipPath = dcipAuthority?.path
    ? join(process.cwd(), dcipAuthority.path)
    : COGNITIVE_INITIALIZATION_PROTOCOL_PATH;

  const primary = loadTemplateFile(
    dcipPath,
    "governance:dream_cognitive_initialization_protocol:primary",
  );
  if (primary.trim().length > 0) return primary;

  return loadTemplateFile(
    LEGACY_COGNITIVE_INITIALIZATION_PROTOCOL_PATH,
    "governance:dream_cognitive_initialization_protocol:legacy",
  );
}

export function buildCompactConstitutionalAuthorityRegistryBlock(): string {
  const status = getConstitutionalAuthorityStatus();
  const lines = [
    "CONSTITUTIONAL AUTHORITY REGISTRY (runtime source of truth):",
    `Registry path: ${status.registryPath}`,
    `Registry status: ${status.status}`,
    "",
    "Required authorities:",
    ...status.entries
      .filter((entry) => entry.required)
      .sort((a, b) => a.level - b.level)
      .map((entry) => `- L${entry.level} ${entry.authorityId} (${entry.runtimeBinding}) → ${entry.path}`),
  ];

  if (status.missingRequiredAuthorities.length > 0) {
    lines.push("", `Missing required authorities: ${status.missingRequiredAuthorities.join(", ")}`);
  }

  return lines.join("\n");
}

/**
 * Load a DREAM evaluation template by key. Returns the full markdown content.
 * Caches after first read; returns empty string on read failure.
 */
export function loadDreamTemplate(key: DreamTemplateKey): string {
  return loadTemplateFile(join(TEMPLATE_DIR, FILE_MAP[key]), `dream:${key}`);
}

/**
 * Load the Story Ledger template. Returns the full markdown content.
 * Caches after first read; returns empty string on read failure.
 */
export function loadStoryLedgerTemplate(): string {
  return loadTemplateFile(STORY_LEDGER_TEMPLATE_PATH, "story_ledger_template");
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
 * Build a compact prompt-ready version of the DREAM Cognitive Initialization
 * Protocol. This block intentionally extracts only the governing headings and
 * first principles so prompts inherit DCIP without copying the whole document.
 */
export function buildCompactCognitiveInitializationBlock(): string {
  const raw = loadDreamCognitiveInitializationProtocol();
  if (!raw) return "";

  const lines = raw.split("\n");
  const sections: string[] = [];
  let currentSection = "";
  let lineCount = 0;
  const MAX_LINES_PER_SECTION = 8;
  let inFrontmatter = false;

  for (const line of lines) {
    if (line.trim() === "---") {
      inFrontmatter = !inFrontmatter;
      continue;
    }
    if (inFrontmatter) continue;

    if (line.startsWith("# ") || line.startsWith("## ")) {
      if (currentSection) sections.push(currentSection.trim());
      currentSection = line + "\n";
      lineCount = 0;
    } else if (currentSection && lineCount < MAX_LINES_PER_SECTION) {
      const trimmed = line.replace(/^[|`-]+$/, "").trim();
      if (trimmed && !trimmed.startsWith("```")) {
        currentSection += trimmed + "\n";
        lineCount++;
      }
    }
  }
  if (currentSection) sections.push(currentSection.trim());

  return [
    "DREAM COGNITIVE INITIALIZATION PROTOCOL (constitutional reasoning authority):",
    "Use this before and during literary reasoning. It governs posture, evidence discipline, preservation, evaluation, revise, queue, and Phase 5 certification. It is not manuscript evidence and must never override direct manuscript evidence.",
    "",
    ...sections,
  ].join("\n");
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

  const joined = sections.join("\n");
  // ── Prompt-injection sanitization (short_form only) ──────────────────────
  // The short-form template references long-form tier names (WAVE, Golden Spine,
  // Phase 5, long-form canon) in its prohibition clauses. If these strings are
  // injected verbatim into the LLM prompt the model may echo them in output prose,
  // triggering SHORT_FORM_LONGFORM_ARTIFACT_LEAK. Replace them with neutral
  // placeholders before injection. The canonical template files are NOT modified.
  const sanitized = key === "short_form"
    ? joined
        .replace(/\bWAVE\b/g, "[ADVANCED-TIER]")
        .replace(/\bGolden Spine\b/gi, "[SPINE-FEATURE]")
        .replace(/\bPhase\s*5\b/gi, "[RELEASE-GATE]")
        .replace(/\blong-form canon\b/gi, "[LONG-FORM-FEATURE]")
        .replace(/\blong[- ]form multi[- ]layer\b/gi, "[LONG-FORM-FEATURE]")
    : joined;

  return [
    `DREAM ${label} EVALUATION TEMPLATE (canonical report shape):`,
    "The evaluation output MUST follow this structure. Sections listed below are REQUIRED unless marked optional.",
    "",
    sanitized,
  ].join("\n");
}

/**
 * Build a compact prompt-ready version of the Story Ledger template.
 * Extracts layer headings, required fields, and failure conditions from the
 * canonical `.md` file to keep prompt injection within a reasonable token budget.
 */
export function buildCompactStoryLedgerBlock(): string {
  const raw = loadStoryLedgerTemplate();
  if (!raw) return "";

  const lines = raw.split("\n");
  const sections: string[] = [];
  let currentSection = "";
  let lineCount = 0;
  const MAX_LINES_PER_SECTION = 15;
  let inFrontmatter = false;

  for (const line of lines) {
    // Skip YAML frontmatter
    if (line.trim() === "---") {
      inFrontmatter = !inFrontmatter;
      continue;
    }
    if (inFrontmatter) continue;

    if (line.startsWith("# ")) {
      if (currentSection) sections.push(currentSection.trim());
      currentSection = line + "\n";
      lineCount = 0;
    } else if (line.startsWith("## ")) {
      if (currentSection) sections.push(currentSection.trim());
      currentSection = line + "\n";
      lineCount = 0;
    } else if (currentSection && lineCount < MAX_LINES_PER_SECTION) {
      const trimmed = line.replace(/^[|`-]+$/, "").trim();
      if (trimmed && !trimmed.startsWith("```")) {
        currentSection += trimmed + "\n";
        lineCount++;
      }
    }
  }
  if (currentSection) sections.push(currentSection.trim());

  return [
    "10-LAYER STORY LEDGER TEMPLATE (canonical registry plus benchmark structure from docs/benchmarks/story-ledger/STORY_LEDGER_10_LAYER_TEMPLATE.md):",
    "Every layer MUST be populated. An empty layer is a failure unless the manuscript genuinely lacks that dimension.",
    "",
    ...sections,
  ].join("\n");
}

/** Clear the template cache (for testing). */
export function clearTemplateCache(): void {
  cache.clear();
}