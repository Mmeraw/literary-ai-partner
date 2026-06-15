import { routeNarrativeEvaluationPreflight } from "@/lib/evaluation/preflight/manuscriptTypeRouting";

describe("routeNarrativeEvaluationPreflight", () => {
  test("blocks business-letter style submissions", () => {
    const decision = routeNarrativeEvaluationPreflight(
      "Dear Andrew, I am writing to share coaching notes for your draft. Best regards, Mentor.",
    );

    expect(decision.allowed).toBe(false);
    expect(decision.detectedType).toBe("business_letter");
  });

  test("allows narrative fiction scene excerpts", () => {
    const decision = routeNarrativeEvaluationPreflight(
      "He walked into the room and said, \"Do not move.\" She stared at the broken window and felt the air go cold.",
    );

    expect(decision.allowed).toBe(true);
    expect(decision.detectedType).toBe("narrative_fiction");
  });

  test("routes long chaptered fiction as narrative despite weak essay-like terms", () => {
    const scene = `Chapter 1

Hyla crouched beneath the moonlit fern and waited for Zimeon to speak.
"The old pond remembers every argument," Zimeon said.
Newbie looked toward the forest path and felt hope rise despite the cold.
Their research into the ruined gate had become a dangerous analysis of courage, not an essay.`;
    const longChapteredFiction = Array.from({ length: 260 }, () => scene).join("\n\n");

    const decision = routeNarrativeEvaluationPreflight(longChapteredFiction);

    expect(decision.allowed).toBe(true);
    expect(decision.detectedType).toBe("narrative_fiction");
    expect(decision.routingReason).toBe(
      "long_form_chapter_dialogue_scene_evidence_overrides_weak_nonfiction_terms",
    );
    expect(decision.scores.weakNonfictionScore).toBeGreaterThanOrEqual(2);
    expect(decision.scores.chapterScore).toBeGreaterThan(0);
    expect(decision.scores.dialogueScore).toBeGreaterThan(1);
  });

  test("weak nonfiction terms do not override strong scene and dialogue evidence", () => {
    const decision = routeNarrativeEvaluationPreflight(
      `Chapter 2
      "The thesis can wait," Mara whispered.
      He walked through the dark forest and felt the argument in his heart dissolve.
      She paused beside the river, certain their research had awakened something ancient.`,
    );

    expect(decision.allowed).toBe(true);
    expect(decision.detectedType).toBe("narrative_fiction");
    expect(decision.routingReason).toBe("strong_narrative_evidence_overrides_weak_nonfiction_terms");
  });

  test("blocks true academic nonfiction with hard nonfiction signals", () => {
    const decision = routeNarrativeEvaluationPreflight(
      `Abstract
      In this essay, I examine the research question behind amphibian folklore.
      This paper argues that the thesis statement requires further analysis.
      Methodology
      The literature review compares three nonfiction sources.
      References`,
    );

    expect(decision.allowed).toBe(false);
    expect(decision.detectedType).toBe("essay_or_nonfiction");
    expect(decision.routingConfidence).toBe("high");
  });

  test("blocks chapter-by-chapter synopsis instead of treating it as manuscript fiction", () => {
    const decision = routeNarrativeEvaluationPreflight(
      `Synopsis
      The novel follows Hyla as she searches for the vanished pond.
      In this story, the protagonist faces betrayal.
      Chapter-by-chapter summary: by the end, Hyla chooses exile.`,
    );

    expect(decision.allowed).toBe(false);
    expect(decision.detectedType).toBe("synopsis");
  });
});
