import { notFound } from "next/navigation";
import type { WorkbenchOpportunity, WorkbenchQueuePayload } from "@/lib/revision/workbenchQueue";
import { buildClassifiedWorkbenchOpportunity, classifyWorkbenchExecutabilityDetailed } from "@/lib/revision/workbenchQueueProjection";
import ReviseCockpitClientWorkflowV2 from "@/components/revision/ReviseCockpitClientWorkflowV2";

function classify(opp: WorkbenchOpportunity) {
  return buildClassifiedWorkbenchOpportunity(opp, classifyWorkbenchExecutabilityDetailed(opp));
}

function candidate(key: "A" | "B" | "C", mechanism: string, text: string, rationale: string) {
  return { key, mechanism, candidateText: text, text, rationale };
}

function copyPasteOpportunity(index: number, title: string, criterion: string, severity: WorkbenchOpportunity["severity"]): WorkbenchOpportunity {
  const original = "The door swung shut, and everyone in the room went quiet.";
  return {
    id: `fixture-copy-${index}`,
    severity,
    scope: "Passage",
    mode: "direct-rewrite",
    source: "evaluation",
    criterion,
    leverage: criterion,
    crumb: `${criterion} · chapter:3`,
    title,
    issueStatement: "The transition cuts over the emotional beat too abruptly.",
    meta: `${criterion} · chapter:3`,
    confidence: "high confidence",
    anchor: "chapter:3",
    quoteHighlight: original,
    quoteRest: "",
    symptom: "The cut skips over the emotional turn.",
    cause: "Missing transitional beat.",
    fixDirection: "Add one grounded bridge before the time jump.",
    readerEffect: "Keeps the reader oriented through the transition.",
    mistakeProofing: "Preserve the original event order.",
    diagnostic: {
      symptom: "The cut skips over the emotional turn.",
      cause: "Missing transitional beat.",
      fixStrategy: "Add one grounded bridge before the time jump.",
      readerImpact: "Keeps the reader oriented through the transition.",
      evidence: { quotedExcerpt: original, locationLabel: "chapter:3" },
      operationTargeting: "replace_selected_passage · chapter:3",
      mistakeProofing: "Preserve the original event order.",
    },
    revisionOperation: "replace_selected_passage",
    readiness: "ready_for_revise",
    readinessReason: "Candidate prose is source anchored.",
    evidenceLocationScope: "Passage",
    repairScope: "Passage",
    groundingStatus: "supported",
    contextQuality: "clean",
    preflightStatus: "passed",
    cardType: "copy_paste_rewrite",
    trustedPathStatus: "eligible",
    options: [
      candidate("A", "Recommended repair", "Mara stepped back into the room, and everyone waited for her to speak.", "Adds a minimal emotional bridge."),
      candidate("B", "Rhythm variant", "The room stilled as everyone turned toward the doorway where Mara stood.", "Keeps the original rhythm."),
      candidate("C", "Bolder rendering shift", "She crossed the room slowly, aware that everyone was watching her every move.", "Adds a stronger emotional image."),
    ],
  };
}

function strategyOpportunity(index: number, title: string, criterion: string, severity: WorkbenchOpportunity["severity"]): WorkbenchOpportunity {
  return {
    id: `fixture-strategy-${index}`,
    severity,
    scope: "Scene",
    mode: "repair-brief",
    source: "evaluation",
    criterion,
    leverage: criterion,
    crumb: `${criterion} · chapter:4`,
    title,
    issueStatement: "A broader scene-level repair is needed; no bounded replacement is safe.",
    meta: `${criterion} · chapter:4`,
    confidence: "medium confidence",
    anchor: "chapter:4",
    quoteHighlight: "The argument escalated without any grounded reaction from the surrounding witnesses.",
    quoteRest: "",
    symptom: "The scene abstracts conflict instead of staging it.",
    cause: "Insufficient sensory and interpersonal context.",
    fixDirection: "Restructure the scene to show reactions before declarations.",
    readerEffect: "Makes the conflict feel earned rather than rhetorical.",
    mistakeProofing: "Do not change the outcome of the confrontation.",
    diagnostic: {
      symptom: "The scene abstracts conflict instead of staging it.",
      cause: "Insufficient sensory and interpersonal context.",
      fixStrategy: "Restructure the scene to show reactions before declarations.",
      readerImpact: "Makes the conflict feel earned rather than rhetorical.",
      evidence: { quotedExcerpt: "The argument escalated without any grounded reaction from the surrounding witnesses.", locationLabel: "chapter:4" },
      operationTargeting: "needs_targeting · chapter:4",
      mistakeProofing: "Do not change the outcome of the confrontation.",
    },
    revisionOperation: "needs_targeting",
    readiness: "needs_targeting",
    readinessReason: "Author review required for scene-level repair.",
    evidenceLocationScope: "Scene",
    repairScope: "Scene",
    groundingStatus: "supported",
    contextQuality: "limited",
    preflightStatus: "limited_context",
    cardType: "revision_strategy",
    trustedPathStatus: "unavailable_author_review_required",
    options: [],
  };
}

function heldOpportunity(index: number, title: string, criterion: string): WorkbenchOpportunity {
  return {
    id: `fixture-held-${index}`,
    severity: "could",
    scope: "Passage",
    mode: "direct-rewrite",
    source: "evaluation",
    criterion,
    leverage: criterion,
    crumb: `${criterion} · chapter:5`,
    title,
    issueStatement: "The evidence is too sparse to generate a safe candidate.",
    meta: `${criterion} · chapter:5`,
    confidence: "low confidence",
    anchor: "chapter:5",
    quoteHighlight: "",
    quoteRest: "",
    symptom: "Symptom description is missing.",
    cause: "Cause not established from the submitted material.",
    fixDirection: "Add more context before reanalysis.",
    readerEffect: "Reader effect not determinable.",
    mistakeProofing: "Do not fabricate evidence.",
    diagnostic: {
      symptom: "Symptom description is missing.",
      cause: "Cause not established from the submitted material.",
      fixStrategy: "Add more context before reanalysis.",
      readerImpact: "Reader effect not determinable.",
      evidence: { quotedExcerpt: "", locationLabel: "chapter:5" },
      operationTargeting: "needs_targeting · chapter:5",
      mistakeProofing: "Do not fabricate evidence.",
    },
    revisionOperation: "needs_targeting",
    readiness: "needs_targeting",
    readinessReason: "Insufficient evidence or context.",
    evidenceLocationScope: "Passage",
    repairScope: "Passage",
    groundingStatus: "unsupported_blocked",
    contextQuality: "blocked",
    preflightStatus: "blocked",
    cardType: "withheld",
    trustedPathStatus: "impossible",
    executabilityReasons: ["Evidence anchor could not be matched against the manuscript."],
    options: [],
  };
}

const payload: WorkbenchQueuePayload = {
  ok: true,
  error: null,
  manuscriptId: "fixture-ms",
  evaluationJobId: "fixture-eval",
  manuscriptTitle: "The River Remembers Blood — Workbench Visual Fixture",
  opportunities: [
    classify(copyPasteOpportunity(1, "Bridge the abrupt transition into Mara\'s return so the emotional beat lands before the time jump", "Pacing", "must")),
    classify(copyPasteOpportunity(2, "Soften the repeated clause rhythm in the river description near the ford", "Prose_variety", "should")),
    classify(strategyOpportunity(3, "Restructure the market argument so reactions precede declarations and stakes are shown rather than told", "Tension", "must")),
    classify(copyPasteOpportunity(4, "Anchor the metaphor to a concrete sensory image rather than an abstract assertion", "Imagery", "should")),
    classify(strategyOpportunity(5, "Distribute the villain\'s reveal across two beats instead of one so the reversal lands", "Suspense", "should")),
    classify(copyPasteOpportunity(6, "Remove the filter phrase that weakens the close third in the sheriff\'s office scene", "POV_voice", "could")),
    classify(strategyOpportunity(7, "Make the chapter ending land on implication rather than summary of what just happened", "Pacing", "could")),
    classify(copyPasteOpportunity(8, "Tighten the dialogue attribution to avoid naming the speaker twice in the same turn", "Dialogue", "could")),
  ],
  needsTargeting: [],
  withheldUnsupported: [
    classify(heldOpportunity(1, "Evaluate the extended flashback in chapter five for relevance and proportion to present action", "Backfill")),
    classify(heldOpportunity(2, "Resolve the historical anachronism in the sheriff\'s office before allowing world-consistent revision", "World_consistency")),
    classify(heldOpportunity(3, "Confirm the secondary antagonist\'s motivation before revising their entrance scene", "Characterization")),
  ],
  readinessTotals: { ready_for_revise: 5, needs_targeting: 3, withheld_unsupported: 3 },
  totals: { must: 2, should: 4, could: 5 },
  scopes: { Line: 1, Passage: 4, Scene: 3, Chapter: 0, Structural: 0, Manuscript: 0 },
  criteria: { Pacing: 3, Prose_variety: 1, Imagery: 1, Tension: 1, Suspense: 1, POV_voice: 1, Dialogue: 1 },
  synthesis: { admitted: 11, clustered: 0, held: 3, suppressed: 0 },
  modeContract: null,
};

export default function ReviseWorkbenchFixturePage() {
  if (process.env.NODE_ENV === "production") {
    return notFound();
  }

  return <ReviseCockpitClientWorkflowV2 payload={payload} />;
}
