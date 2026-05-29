import { describe, expect, it } from "@jest/globals";
import { sanitizeAuthorFacingRevisionPlanInPass3b } from "@/lib/evaluation/pipeline/runPass3bLongform";

describe("sanitizeAuthorFacingRevisionPlanInPass3b", () => {
  it("removes internal/system diagnostic priorities and renumbers remaining author-facing priorities", () => {
    const raw = {
      revision_plan: [
        {
          priority: 1,
          title: "Correct Source-Integrity Semantics",
          goal: "Repair HARD_FAIL/DEGRADED_EXTRACTION status semantics.",
          actions: ["Normalize diagnostic status taxonomy"],
          acceptance_check: "Source Integrity status is consistent.",
        },
        {
          priority: 2,
          title: "Tighten midpoint confrontation",
          goal: "Increase emotional consequence in the middle acts.",
          actions: [
            "Rewrite the midpoint exchange to force an irreversible choice.",
            "Add one callback line from the opening promise.",
          ],
          acceptance_check: "Beta readers identify a clear midpoint turn with emotional cost.",
        },
        {
          priority: 3,
          title: "Repair Relationship Network Representation",
          goal: "Fix no qualifying relationship pairs found diagnostics.",
          actions: ["Rebuild relationship extraction graph"],
          acceptance_check: "Relationship network diagnostics pass.",
        },
        {
          priority: 4,
          title: "Sharpen ending emotional aftercare",
          goal: "Ensure the final chapter resolves emotional debt after plot closure.",
          actions: [
            "Add 1-2 paragraphs of emotional aftercare in the final scene.",
            "Cut one redundant summary beat.",
          ],
          acceptance_check: "Final act shows plot closure and emotional aftercare as distinct beats.",
        },
      ],
      calibration_notes: ["Preserve tonal restraint while increasing emotional specificity."],
    } as Record<string, unknown>;

    const { patched, report } = sanitizeAuthorFacingRevisionPlanInPass3b(raw);
    const plan = patched.revision_plan as Array<Record<string, unknown>>;

    expect(plan).toHaveLength(2);
    expect(plan[0].priority).toBe(1);
    expect(plan[1].priority).toBe(2);
    expect(plan[0].title).toBe("Tighten midpoint confrontation");
    expect(plan[1].title).toBe("Sharpen ending emotional aftercare");

    expect(report.removed_entries).toEqual([
      "Correct Source-Integrity Semantics",
      "Repair Relationship Network Representation",
    ]);

    const notes = patched.calibration_notes as string[];
    expect(notes.some((note) => note.includes("[Pass3b guardrail]"))).toBe(true);
  });

  it("strips internal diagnostic actions while preserving valid manuscript actions", () => {
    const raw = {
      revision_plan: [
        {
          priority: 1,
          title: "Strengthen chapter-level causal chain",
          goal: "Make each chapter-ending decision force the next chapter opening.",
          actions: [
            "Reframe Threat / Pressure / Ending Taxonomy",
            "Normalize Location / Timeline",
            "Rewrite each chapter ending to expose an unresolved consequence.",
            "Merge two redundant setup scenes in Act II.",
          ],
          acceptance_check: "Every chapter transition has an explicit unresolved consequence.",
        },
        {
          priority: 2,
          title: "Clarify symbol transfer and payoff",
          goal: "Track the symbol lifecycle from first appearance to final payoff.",
          actions: [
            "Correct Symbol/Object Layer Weighting",
            "Seed the symbol transfer beat in Chapter 3 and pay it off in the finale.",
          ],
          acceptance_check: "Symbol appears, transfers, and pays off in traceable sequence.",
        },
        {
          priority: 3,
          title: "Increase scene-level compression",
          goal: "Reduce repetitive exposition in middle chapters.",
          actions: ["Cut repetitive exposition by 20% in Chapters 9-12."],
          acceptance_check: "Middle chapters show reduced repetition without loss of clarity.",
        },
      ],
      calibration_notes: [],
    } as Record<string, unknown>;

    const { patched, report } = sanitizeAuthorFacingRevisionPlanInPass3b(raw);
    const plan = patched.revision_plan as Array<Record<string, unknown>>;

    expect(plan).toHaveLength(3);
    expect(plan[0].actions).toEqual([
      "Rewrite each chapter ending to expose an unresolved consequence.",
      "Merge two redundant setup scenes in Act II.",
    ]);
    expect(plan[1].actions).toEqual([
      "Seed the symbol transfer beat in Chapter 3 and pay it off in the finale.",
    ]);
    expect(report.removed_entries).toHaveLength(0);
    expect(report.removed_actions_count).toBe(3);
  });
});
