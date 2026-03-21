import { ACTIVE_RULES } from "./ACTIVE_RULES";
import type {
  EnforcementDecision,
  LessonsLearnedReport,
  RuleEvaluationInput,
  RuleEvaluationResult,
  RuleStage,
} from "./types";

export function evaluateLessonsLearnedRules(
  input: RuleEvaluationInput,
  stage?: RuleStage,
): LessonsLearnedReport {
  const rules = stage
    ? ACTIVE_RULES.filter((rule) => rule.enforcement_stages.includes(stage))
    : ACTIVE_RULES;

  const results: RuleEvaluationResult[] = [];

  for (const rule of rules) {
    const ruleResult = rule.predicate(input);

    results.push({
      rule_id: rule.rule_id,
      name: rule.name,
      passed: ruleResult.passed,
      severity: rule.severity,
      violations: ruleResult.violations ?? [],
      evidence: ruleResult.evidence,
    });
  }

  return {
    overall_pass: results.every((r) => r.passed || r.severity !== "ERROR"),
    results,
  };
}

export function deriveLessonsLearnedEnforcementDecision(
  report: LessonsLearnedReport,
): EnforcementDecision {
  const hasErrorViolation = report.results.some(
    (r) => r.severity === "ERROR" && !r.passed,
  );

  if (hasErrorViolation) {
    return {
      action: "BLOCK",
      reason: "At least one ERROR-severity lessons-learned rule failed.",
    };
  }

  const hasWarnings = report.results.some(
    (r) => r.severity === "WARNING" && !r.passed,
  );

  if (hasWarnings) {
    return {
      action: "ALLOW_WITH_WARNINGS",
      reason: "No ERROR failures; WARNING-severity violations recorded.",
    };
  }

  return {
    action: "ALLOW",
    reason: "All applicable lessons-learned rules passed.",
  };
}
