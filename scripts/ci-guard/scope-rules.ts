export type PathCategory =
  | "user-facing"
  | "internal"
  | "governance"
  | "protected"
  | "tooling"
  | "test"
  | "unknown";

export interface PathClassification {
  readonly relativePath: string;
  readonly category: PathCategory;
  readonly inScope: boolean;
  readonly rationale: string;
}

export function classifyPath(relativePath: string): PathClassification {
  if (relativePath.startsWith("protected/")) {
    return {
      relativePath,
      category: "protected",
      inScope: false,
      rationale: "Protected ontology path; scanner does not inspect ontology files.",
    };
  }

  if (relativePath.startsWith("docs/governance/") || relativePath.startsWith("docs/")) {
    return {
      relativePath,
      category: "governance",
      inScope: false,
      rationale: "Governance/documentation path; out of runtime user-facing scope.",
    };
  }

  if (
    relativePath.startsWith("tests/") ||
    relativePath.startsWith("test/") ||
    relativePath.endsWith(".test.ts") ||
    relativePath.endsWith(".test.tsx") ||
    relativePath.endsWith(".spec.ts") ||
    relativePath.endsWith(".spec.tsx")
  ) {
    return {
      relativePath,
      category: "test",
      inScope: false,
      rationale: "Test path; out of user-facing enforcement scope.",
    };
  }

  if (
    relativePath.startsWith("scripts/") ||
    relativePath.startsWith(".github/") ||
    relativePath === "package.json" ||
    relativePath === "tsconfig.json" ||
    relativePath.endsWith(".config.ts") ||
    relativePath.endsWith(".config.js") ||
    relativePath.endsWith(".config.mjs")
  ) {
    return {
      relativePath,
      category: "tooling",
      inScope: false,
      rationale: "Tooling/CI path; not a wire-crossing surface.",
    };
  }

  if (
    relativePath.startsWith("app/") ||
    relativePath.startsWith("components/") ||
    relativePath.startsWith("public/") ||
    relativePath.startsWith("lib/api/") ||
    relativePath.startsWith("lib/export/") ||
    relativePath.startsWith("lib/ui/")
  ) {
    return {
      relativePath,
      category: "user-facing",
      inScope: true,
      rationale: "Wire-crossing surface; subject to boundary integrity enforcement.",
    };
  }

  return {
    relativePath,
    category: "internal",
    inScope: false,
    rationale: "Internal logic path; out of user-facing scope.",
  };
}
