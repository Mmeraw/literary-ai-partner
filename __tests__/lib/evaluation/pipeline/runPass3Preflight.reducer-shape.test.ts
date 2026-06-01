import { extractReducerCriterionDrafts } from "@/lib/evaluation/pipeline/runPass3Preflight";

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
