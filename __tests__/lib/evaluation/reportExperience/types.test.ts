import {
  deriveReportExperienceVerdict,
  type ReportExperienceScores,
} from "@/lib/evaluation/reportExperience/types";

function makeScores(overrides: Partial<ReportExperienceScores> = {}): ReportExperienceScores {
  return {
    authorFeelsSeen: 5,
    candorWithoutCruelty: 5,
    recoveryPathClarity: 5,
    specificityOfGuidance: 5,
    motivationalEnergy: 5,
    noFalsePraise: true,
    noUnsupportedSuperlatives: true,
    ...overrides,
  };
}

describe("deriveReportExperienceVerdict", () => {
  it("returns fail_report_polish when any numeric score is below 2", () => {
    expect(
      deriveReportExperienceVerdict(makeScores({ authorFeelsSeen: 1 })),
    ).toBe("fail_report_polish");
  });

  it("returns rerender when any numeric score is 2", () => {
    expect(
      deriveReportExperienceVerdict(makeScores({ recoveryPathClarity: 2 })),
    ).toBe("rerender");
  });

  it("returns pass when all numeric scores are at least 3 and boolean guards pass", () => {
    expect(
      deriveReportExperienceVerdict(
        makeScores({
          authorFeelsSeen: 3,
          candorWithoutCruelty: 3,
          recoveryPathClarity: 3,
          specificityOfGuidance: 3,
          motivationalEnergy: 3,
        }),
      ),
    ).toBe("pass");
  });

  it("returns rerender when false praise is detected", () => {
    expect(
      deriveReportExperienceVerdict(makeScores({ noFalsePraise: false })),
    ).toBe("rerender");
  });

  it("returns rerender when unsupported superlatives are detected", () => {
    expect(
      deriveReportExperienceVerdict(makeScores({ noUnsupportedSuperlatives: false })),
    ).toBe("rerender");
  });
});
