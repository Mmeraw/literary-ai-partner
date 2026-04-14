import { type ProposedEdit } from "./diffIntelligence";
import { type WaveEntry, getWave, type WaveCategory } from "./waveRegistry";

export type RevisionMode = "surgical" | "standard" | "deep";

export type EditScope = "token" | "phrase" | "sentence" | "paragraph" | "scene" | "chapter";

export const SCOPE_RANK: Record<EditScope, number> = {
  token: 1,
  phrase: 2,
  sentence: 3,
  paragraph: 4,
  scene: 5,
  chapter: 6,
};

function toEditScope(scope: string): EditScope {
  const normalized = scope.trim().toLowerCase();
  if (normalized === "token") return "token";
  if (normalized === "phrase") return "phrase";
  if (normalized === "sentence") return "sentence";
  if (normalized === "paragraph") return "paragraph";
  if (normalized === "scene") return "scene";
  if (normalized === "chapter") return "chapter";

  // Conservative fallback: unknown scopes are treated as broad.
  return "chapter";
}

function getScopeScore(edit: ProposedEdit): number {
  const candidate = (edit as ProposedEdit & { scopeScore?: unknown }).scopeScore;
  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    return candidate;
  }

  // Fallback scoring derived from scope rank when explicit scopeScore is absent.
  const rank = SCOPE_RANK[toEditScope(edit.scope)];
  return rank * 15;
}

function truncateToTwoSentences(text: string): string {
  const parts = text.match(/[^.!?]+[.!?]*|[^.!?]+$/g);
  if (!parts || parts.length === 0) {
    return text.trim();
  }

  return parts
    .slice(0, 2)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .join(" ")
    .trim();
}

function getSurgicalAllowedScopesByCategory(category: WaveCategory): Set<EditScope> {
  if (category === "dialogue" || category === "polish") {
    return new Set<EditScope>(["phrase", "sentence"]);
  }

  if (category === "sceneConstruction" || category === "narrativeDrive" || category === "scene") {
    return new Set<EditScope>(["sentence"]);
  }

  if (category === "character" || category === "voice") {
    return new Set<EditScope>(["phrase", "sentence"]);
  }

  return new Set<EditScope>(["token", "phrase", "sentence"]);
}

export function isAllowedScope(
  scope: EditScope,
  mode: RevisionMode,
): boolean {
  const rank = SCOPE_RANK[scope];

  if (mode === "surgical") {
    return rank <= 3;
  }

  if (mode === "standard") {
    return rank <= 4;
  }

  return true;
}

export function downgradeEditForSurgicalMode(edit: ProposedEdit): ProposedEdit | null {
  const scopeScore = getScopeScore(edit);

  if (scopeScore <= 35) {
    return edit;
  }

  if (scopeScore <= 55) {
    const downgradedText = truncateToTwoSentences(edit.proposedText);
    const existingTags = Array.isArray(edit.tags) ? edit.tags : [];

    return {
      ...edit,
      proposedText: downgradedText.length > 0 ? downgradedText : edit.proposedText,
      scope: "sentence",
      confidence: Math.max(0, Number((edit.confidence - 0.2).toFixed(3))),
      tags: existingTags.includes("surgical-downgraded")
        ? existingTags
        : [...existingTags, "surgical-downgraded"],
    };
  }

  return null;
}

export function enforceWaveSurgicalLimits(
  waveId: number,
  edits: ProposedEdit[],
  mode: RevisionMode,
): { allowed: ProposedEdit[]; blocked: ProposedEdit[]; downgraded: ProposedEdit[] } {
  const wave: WaveEntry | undefined = getWave(waveId);
  const categoryAllowedScopes = getSurgicalAllowedScopesByCategory(wave?.category ?? "proseControl");

  const allowed: ProposedEdit[] = [];
  const blocked: ProposedEdit[] = [];
  const downgraded: ProposedEdit[] = [];

  for (const edit of edits) {
    const currentScope = toEditScope(edit.scope);

    if (mode !== "surgical") {
      if (isAllowedScope(currentScope, mode)) {
        allowed.push(edit);
      } else {
        blocked.push(edit);
      }
      continue;
    }

    const baseAllowedByMode = isAllowedScope(currentScope, mode);
    const allowedByCategory = categoryAllowedScopes.has(currentScope);

    if (baseAllowedByMode && allowedByCategory) {
      allowed.push(edit);
      continue;
    }

    const downgradedEdit = downgradeEditForSurgicalMode(edit);
    if (!downgradedEdit) {
      blocked.push(edit);
      continue;
    }

    const downgradedScope = toEditScope(downgradedEdit.scope);
    const downgradedAllowed =
      isAllowedScope(downgradedScope, mode) && categoryAllowedScopes.has(downgradedScope);

    if (!downgradedAllowed) {
      blocked.push(edit);
      continue;
    }

    allowed.push(downgradedEdit);
    if (downgradedEdit !== edit) {
      downgraded.push(downgradedEdit);
    }
  }

  return {
    allowed,
    blocked,
    downgraded,
  };
}

export function buildSurgicalEnforcementReport(
  waveId: number,
  original: ProposedEdit[],
  result: ReturnType<typeof enforceWaveSurgicalLimits>,
): {
  waveId: number;
  originalCount: number;
  allowedCount: number;
  blockedCount: number;
  downgradedCount: number;
  enforcementActive: boolean;
} {
  const originalCount = original.length;
  const allowedCount = result.allowed.length;
  const blockedCount = result.blocked.length;
  const downgradedCount = result.downgraded.length;

  const enforcementActive = blockedCount > 0 || downgradedCount > 0 || allowedCount !== originalCount;

  return {
    waveId,
    originalCount,
    allowedCount,
    blockedCount,
    downgradedCount,
    enforcementActive,
  };
}
