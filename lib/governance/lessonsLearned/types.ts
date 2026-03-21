import type { CanonRegistry } from "@/lib/governance/canonRegistry";
import type { SinglePassOutput, SynthesisOutput } from "@/lib/evaluation/pipeline/types";

export type RuleStage =
	| "post_structural"
	| "post_diagnostic"
	| "post_convergence"
	| "pre_artifact_generation";

export type RuleSeverity = "ERROR" | "WARNING" | "ADVISORY";

// Contract aliases that map directly onto existing Phase 2.7 pipeline types.
export type EvaluationResult = SinglePassOutput;
export type DiagnosticResult = SinglePassOutput;
export type ConvergenceResult = SynthesisOutput;

export type RuleViolation = {
	message: string;
	location?: string;
	severity: RuleSeverity;
};

export type RuleResult = {
	passed: boolean;
	violations?: RuleViolation[];
	evidence?: unknown;
};

export type RuleEvaluationInput = {
	manuscript_id: string;
	execution_mode: "TRUSTED_PATH" | "STUDIO";
	structural_result?: EvaluationResult;
	diagnostic_result?: DiagnosticResult;
	convergence_result?: ConvergenceResult;
	registry: CanonRegistry;
	metadata: {
		trace_id: string;
		timestamp: string;
	};
};

export type LessonsLearnedRule = {
	rule_id: string;
	canon_reference: string;
	name: string;
	description: string;
	enforcement_stages: RuleStage[];
	severity: RuleSeverity;
	predicate: (input: RuleEvaluationInput) => RuleResult;
	failure_message: string;
	explanation: string;
};

export type RuleEvaluationResult = {
	rule_id: string;
	name: string;
	passed: boolean;
	severity: RuleSeverity;
	violations: RuleViolation[];
	evidence?: unknown;
};

export type LessonsLearnedReport = {
	overall_pass: boolean;
	results: RuleEvaluationResult[];
};

export type EnforcementDecision =
	| { action: "BLOCK"; reason: string }
	| { action: "ALLOW_WITH_WARNINGS"; reason: string }
	| { action: "ALLOW"; reason: string };

