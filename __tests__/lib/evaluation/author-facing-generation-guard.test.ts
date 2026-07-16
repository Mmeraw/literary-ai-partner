export {};

const fs = require("fs");
const path = require("path");

type GenerationMode = "canonical" | "auxiliary" | "delegate" | "internal" | "exception";

type GenerationContract = {
  mode: GenerationMode;
  rationale: string;
  requiredAnyOf?: RegExp[];
  forbidden?: RegExp[];
};

const repoRoot = path.resolve(__dirname, "../../..");

/**
 * Explicit classification of every currently known production file that either
 * calls an LLM directly or owns an author-facing normalization choke point.
 *
 * New direct generation files are discovered automatically below and must be
 * added here with a non-empty rationale before CI will pass.
 */
const AUTHOR_FACING_GENERATION_CONTRACTS: Record<string, GenerationContract> = {
  "lib/evaluation/pipeline/runPipeline.ts": {
    mode: "canonical",
    rationale: "Canonical evaluation assembly must normalize typed synthesis before integrity validation and persistence.",
    requiredAnyOf: [/\bnormalizeArtifact\s*\(/u],
    forbidden: [/\bsanitizeCMOS\s*\(/u],
  },
  "lib/evaluation/pipeline/repairSynthesisIntegrity.ts": {
    mode: "canonical",
    rationale: "Regenerated canonical prose must re-enter the same normalizeArtifact boundary before projections are rebuilt.",
    requiredAnyOf: [/\bnormalizeArtifact\s*\(/u],
    forbidden: [/\bsanitizeCMOS\s*\(/u],
  },
  "lib/evaluation/processor.ts": {
    mode: "delegate",
    rationale: "The production worker delegates evaluation generation to runPipeline and must not become a parallel sanitizer authority.",
    requiredAnyOf: [/\brunPipeline\s*\(/u],
    forbidden: [/\bsanitizeCMOS\s*\(/u],
  },
  "lib/evaluation/reportRenderSafety.ts": {
    mode: "auxiliary",
    rationale: "Legacy/render-safe text is an auxiliary surface and must use the approved CMOS sanitizer rather than mutate canonical artifacts.",
    requiredAnyOf: [/\bsanitizeCMOS\s*\(/u],
  },
  "lib/revision/workbenchQueue.ts": {
    mode: "auxiliary",
    rationale: "Workbench copy is a separately derived author-facing surface and must pass through the approved surface sanitizer.",
    requiredAnyOf: [/\bsanitizeCMOS\s*\(/u],
  },

  // Direct LLM producers upstream of the canonical evaluation boundary.
  "lib/evaluation/pipeline/runPass1.ts": {
    mode: "delegate",
    rationale: "Pass 1 produces typed intermediate analysis consumed by runPipeline before canonical normalization.",
  },
  "lib/evaluation/pipeline/runPass1a.ts": {
    mode: "delegate",
    rationale: "Pass 1A produces typed story-layer intermediates consumed by the canonical pipeline.",
  },
  "lib/evaluation/pipeline/runPass2.ts": {
    mode: "delegate",
    rationale: "Pass 2 produces typed criterion analysis that is normalized only after synthesis assembly.",
  },
  "lib/evaluation/pipeline/runPass3Synthesis.ts": {
    mode: "delegate",
    rationale: "Pass 3 synthesis feeds runPipeline/repairSynthesisIntegrity, where canonical normalization and integrity validation occur.",
  },
  "lib/evaluation/pipeline/runPass3bLongform.ts": {
    mode: "delegate",
    rationale: "Long-form synthesis feeds the same canonical assembly boundary as short-form synthesis.",
  },
  "lib/evaluation/pipeline/runPass3ReadAhead.ts": {
    mode: "internal",
    rationale: "Read-ahead output is internal synthesis context, not directly presented or persisted as canonical author-facing prose.",
  },
  "lib/evaluation/pipeline/runPass3Preflight.ts": {
    mode: "internal",
    rationale: "Preflight output is internal planning/context and is not a presentation authority.",
  },
  "lib/evaluation/pipeline/requiredProseRegeneration.ts": {
    mode: "delegate",
    rationale: "Required-prose regeneration returns source fields to repairSynthesisIntegrity for canonical normalization and revalidation.",
  },
  "lib/evaluation/polishPass.ts": {
    mode: "delegate",
    rationale: "Evaluation polish output remains upstream of canonical artifact normalization and certification.",
  },
  "lib/evaluation/seed/semanticSeedGenerator.ts": {
    mode: "internal",
    rationale: "Semantic seeds are internal model context and are not rendered as author-facing report content.",
  },
  "lib/evaluation/seed/editorialDreamSeedGenerator.ts": {
    mode: "internal",
    rationale: "Editorial dream seeds are internal model context and are not a canonical presentation surface.",
  },
  "lib/evaluation/seed/fullContextStoryLedger.ts": {
    mode: "internal",
    rationale: "The story ledger is an internal grounding artifact, not directly presented as author-facing prose.",
  },

  // Revision and unrelated generation surfaces require explicit classification.
  "lib/revision/runPass4VoiceRewrite.ts": {
    mode: "exception",
    rationale: "Revision candidate prose follows the revision-candidate validation contract, not the evaluation artifact contract.",
  },
  "lib/revision/diagnosticEnrichment.ts": {
    mode: "exception",
    rationale: "Diagnostic enrichment is a revision-domain generator governed by revision-specific validation and persistence.",
  },
  "lib/revision/candidateHydration.ts": {
    mode: "exception",
    rationale: "Candidate hydration creates optional revision candidates and is governed by candidate-specific integrity checks.",
  },
  "app/api/agent-readiness/generate/route.ts": {
    mode: "exception",
    rationale: "Agent-readiness generation is an administrative product surface, not RevisionGrade evaluation or revision prose.",
  },
};

const ROOTS_TO_SCAN = [
  "lib/evaluation",
  "lib/revision",
  "workers",
  "app/api",
];

const SKIPPED_DIRECTORY_NAMES = new Set([
  "__tests__",
  "fixtures",
  "mocks",
  "__mocks__",
  "node_modules",
  ".next",
  "coverage",
]);

const DIRECT_LLM_PATTERNS = [
  /\bnew\s+OpenAI\s*\(/u,
  /\.chat\.completions\.create\s*\(/u,
  /\.responses\.create\s*\(/u,
  /\bgenerateObject\s*\(/u,
  /\bgenerateText\s*\(/u,
];

const AUTHOR_FACING_SIGNAL_PATTERNS = [
  /\brecommendations?\b/iu,
  /\bone_paragraph_summary\b/u,
  /\bone_sentence_pitch\b/u,
  /\bfinal_rationale\b/u,
  /\breader_effect\b/u,
  /\bspecific_fix\b/u,
  /\bcandidate_text_[abc]\b/u,
  /\bauthor_facing_reason\b/u,
];

function stripComments(source: string): string {
  let out = "";
  let state: "code" | "single" | "double" | "template" | "line-comment" | "block-comment" = "code";
  let escaped = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (state === "line-comment") {
      if (char === "\n") {
        state = "code";
        out += char;
      } else {
        out += " ";
      }
      continue;
    }

    if (state === "block-comment") {
      if (char === "*" && next === "/") {
        out += "  ";
        i += 1;
        state = "code";
      } else {
        out += char === "\n" ? "\n" : " ";
      }
      continue;
    }

    if (state === "single" || state === "double" || state === "template") {
      out += char;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (
        (state === "single" && char === "'") ||
        (state === "double" && char === '"') ||
        (state === "template" && char === "`")
      ) {
        state = "code";
      }
      continue;
    }

    if (char === "/" && next === "/") {
      out += "  ";
      i += 1;
      state = "line-comment";
      continue;
    }
    if (char === "/" && next === "*") {
      out += "  ";
      i += 1;
      state = "block-comment";
      continue;
    }
    if (char === "'") state = "single";
    if (char === '"') state = "double";
    if (char === "`") state = "template";
    out += char;
  }

  return out;
}

function collectProductionFiles(relativeRoot: string): string[] {
  const absoluteRoot = path.join(repoRoot, relativeRoot);
  if (!fs.existsSync(absoluteRoot)) return [];

  const files: string[] = [];
  const visit = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && SKIPPED_DIRECTORY_NAMES.has(entry.name)) continue;
      const absolutePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (entry.isFile() && /\.(ts|tsx)$/u.test(entry.name)) {
        files.push(path.relative(repoRoot, absolutePath).replace(/\\/gu, "/"));
      }
    }
  };

  visit(absoluteRoot);
  return files;
}

function isDirectAuthorFacingGenerator(source: string): boolean {
  const code = stripComments(source);
  return (
    DIRECT_LLM_PATTERNS.some((pattern) => pattern.test(code)) &&
    AUTHOR_FACING_SIGNAL_PATTERNS.some((pattern) => pattern.test(code))
  );
}

function findUnclassifiedGenerationPaths(files: string[]): string[] {
  return files.filter((relativePath) => {
    const source = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
    return isDirectAuthorFacingGenerator(source) && !AUTHOR_FACING_GENERATION_CONTRACTS[relativePath];
  });
}

describe("author-facing generation architecture guard", () => {
  test("every discovered direct author-facing generator has an explicit classified contract", () => {
    const productionFiles = ROOTS_TO_SCAN.flatMap(collectProductionFiles);
    expect(findUnclassifiedGenerationPaths(productionFiles)).toEqual([]);
  });

  test("every contract has a non-empty rationale and references a real production file", () => {
    for (const [relativePath, contract] of Object.entries(AUTHOR_FACING_GENERATION_CONTRACTS)) {
      expect(contract.rationale.trim().length).toBeGreaterThan(20);
      expect(fs.existsSync(path.join(repoRoot, relativePath))).toBe(true);
    }
  });

  test("canonical and auxiliary choke points satisfy their declared boundaries outside comments", () => {
    for (const [relativePath, contract] of Object.entries(AUTHOR_FACING_GENERATION_CONTRACTS)) {
      const source = stripComments(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));

      if (contract.requiredAnyOf && contract.requiredAnyOf.length > 0) {
        expect(contract.requiredAnyOf.some((pattern) => pattern.test(source))).toBe(true);
      }
      for (const forbidden of contract.forbidden ?? []) {
        expect(source).not.toMatch(forbidden);
      }
    }
  });

  test("the guard detects a newly introduced unregistered generation path", () => {
    const syntheticPath = "lib/evaluation/pipeline/newAuthorFacingGenerator.ts";
    const syntheticSource = `
      import OpenAI from "openai";
      const client = new OpenAI();
      export async function generate() {
        const response = await client.chat.completions.create({ model: "test", messages: [] });
        return { recommendations: [{ specific_fix: response.choices[0].message.content }] };
      }
    `;

    expect(isDirectAuthorFacingGenerator(syntheticSource)).toBe(true);
    expect(AUTHOR_FACING_GENERATION_CONTRACTS[syntheticPath]).toBeUndefined();
  });
});
