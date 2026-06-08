import {
  extractReducerCriterionDrafts,
  normalizeChunkObservation,
  unwrapJsonBoundary,
} from "@/lib/evaluation/pipeline/runPass3Preflight";

describe("Pass 3A JSON boundary unwrapping", () => {
  test("preserves chunk criterionSignals after JSON boundary parsing", () => {
    const raw = JSON.stringify({
      chunkIndex: 0,
      actZone: "Opening",
      wordCount: 42,
      narrativeEvents: ["Mike receives a call that shifts the scene."],
      criterionSignals: [
        {
          criterion: "hookStrength",
          signal: "strength",
          evidenceQuotes: ["The phone rang again."],
          provisionalNote: "The opening introduces immediate pressure.",
        },
      ],
    });

    const payload = unwrapJsonBoundary<Record<string, unknown>>(
      raw,
      "Pass3A chunk observation",
    );
    const observation = normalizeChunkObservation(payload);

    expect(payload).not.toHaveProperty("value");
    expect(observation.criterionSignals).toHaveLength(1);
    expect(observation.criterionSignals[0]).toMatchObject({
      criterion: "hookStrength",
      signal: "strength",
      provisionalNote: "The opening introduces immediate pressure.",
    });
    expect(observation.narrativeEvents).toEqual([
      "Mike receives a call that shifts the scene.",
    ]);
  });

  test("feeds unwrapped reducer JSON into criterion draft extraction", () => {
    const payload = unwrapJsonBoundary<Record<string, unknown>>(
      JSON.stringify({
        criterionDrafts: [{ criterion: "hookStrength", provisionalScore: 7 }],
      }),
      "Pass3A reducer",
    );

    const drafts = extractReducerCriterionDrafts(payload);

    expect(payload).not.toHaveProperty("value");
    expect(drafts).toHaveLength(1);
    expect(drafts?.[0]?.criterion).toBe("hookStrength");
  });
});

describe("extractReducerCriterionDrafts", () => {
  test("accepts canonical criterionDrafts array", () => {
    const drafts = extractReducerCriterionDrafts({
      criterionDrafts: [{ criterion: "hookStrength", provisionalScore: 7 }],
    });

    expect(drafts).toHaveLength(1);
    expect(drafts?.[0]?.criterion).toBe("hookStrength");
  });

  test("accepts snake_case criterion_drafts array", () => {
    const drafts = extractReducerCriterionDrafts({
      criterion_drafts: [{ criterion: "hookStrength", provisionalScore: 6 }],
    });

    expect(drafts).toHaveLength(1);
    expect(drafts?.[0]?.criterion).toBe("hookStrength");
  });

  test("accepts nested preflight key variants", () => {
    const drafts = extractReducerCriterionDrafts({
      preflight: {
        criteria_drafts: [{ criterion: "hookStrength", provisionalScore: 8 }],
      },
    });

    expect(drafts).toHaveLength(1);
    expect(drafts?.[0]?.criterion).toBe("hookStrength");
  });

  test("accepts object-map drafts and injects missing criterion from key", () => {
    const drafts = extractReducerCriterionDrafts({
      criterionDrafts: {
        hookStrength: { provisionalScore: 5 },
      },
    });

    expect(drafts).toHaveLength(1);
    expect(drafts?.[0]?.criterion).toBe("hookStrength");
  });

  test("returns null when no supported drafts shape exists", () => {
    expect(extractReducerCriterionDrafts({ foo: "bar" })).toBeNull();
    expect(extractReducerCriterionDrafts(null)).toBeNull();
  });
});
