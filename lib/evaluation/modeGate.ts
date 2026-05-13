import type {
  DetectedMode,
  EvaluationMode,
  SectionModeOverride,
  VoicePreservationMode,
} from "@/lib/evaluation/modeDetection";

export type ConfirmedMode = {
  evaluationMode: EvaluationMode;
  voicePreservationMode: VoicePreservationMode;
  sectionOverrides?: SectionModeOverride[];
};

export type ModeConfirmationAction = "keep" | "replace" | "refine";

export type ModeGateResult =
  | { ok: true }
  | {
      ok: false;
      code: "MODE_NOT_CONFIRMED";
      message: string;
    };

export type ModeTelemetryEventType =
  | "mode_proposal_accepted"
  | "mode_proposal_replaced"
  | "mode_proposal_refined";

export type ModeTelemetryEvent = {
  event: ModeTelemetryEventType;
  timestamp: string;
  proposal: {
    evaluationMode: EvaluationMode;
    voicePreservationMode: VoicePreservationMode;
  };
  confirmed: {
    evaluationMode: EvaluationMode;
    voicePreservationMode: VoicePreservationMode;
  };
};

export function toConfirmedModeFromDetection(detected: DetectedMode): ConfirmedMode {
  return {
    evaluationMode: detected.proposedEvaluationMode,
    voicePreservationMode: detected.proposedVoicePreservationMode,
  };
}

export function validateConfirmedModeGate(confirmedMode: ConfirmedMode | null | undefined): ModeGateResult {
  if (!confirmedMode) {
    return {
      ok: false,
      code: "MODE_NOT_CONFIRMED",
      message:
        "A manuscript with no confirmed Evaluation Mode and no confirmed Voice Preservation Mode cannot enter Revise and cannot trigger Trustpath.",
    };
  }

  return { ok: true };
}

export function resolveModeConfirmation(params: {
  detectedMode: DetectedMode;
  action: ModeConfirmationAction;
  requestedMode?: ConfirmedMode;
}): { confirmedMode: ConfirmedMode; telemetryEvent: ModeTelemetryEvent } {
  const proposal = {
    evaluationMode: params.detectedMode.proposedEvaluationMode,
    voicePreservationMode: params.detectedMode.proposedVoicePreservationMode,
  };

  if (params.action === "keep") {
    const confirmedMode = toConfirmedModeFromDetection(params.detectedMode);
    return {
      confirmedMode,
      telemetryEvent: {
        event: "mode_proposal_accepted",
        timestamp: new Date().toISOString(),
        proposal,
        confirmed: {
          evaluationMode: confirmedMode.evaluationMode,
          voicePreservationMode: confirmedMode.voicePreservationMode,
        },
      },
    };
  }

  if (!params.requestedMode) {
    throw new Error(`Mode confirmation action '${params.action}' requires requestedMode payload.`);
  }

  const event = params.action === "replace" ? "mode_proposal_replaced" : "mode_proposal_refined";

  return {
    confirmedMode: params.requestedMode,
    telemetryEvent: {
      event,
      timestamp: new Date().toISOString(),
      proposal,
      confirmed: {
        evaluationMode: params.requestedMode.evaluationMode,
        voicePreservationMode: params.requestedMode.voicePreservationMode,
      },
    },
  };
}

export function deriveReviseEligibilityLabel(params: {
  confirmedMode: ConfirmedMode;
  isMustSpine?: boolean;
}):
  | "Eligible for Trustpath"
  | "Manual only — Voice Preservation (Maximum)"
  | "Manual only — Testimony guardrail"
  | "Manual only — MUST SPINE" {
  if (params.isMustSpine) return "Manual only — MUST SPINE";
  if (params.confirmedMode.evaluationMode === "TESTIMONY") return "Manual only — Testimony guardrail";
  if (params.confirmedMode.voicePreservationMode === "MAXIMUM") {
    return "Manual only — Voice Preservation (Maximum)";
  }
  return "Eligible for Trustpath";
}

export type TrustpathOpportunity = {
  id: string;
  trustpathEligible: boolean;
};

export function computeRetroactiveModeChangeImpact(params: {
  opportunities: TrustpathOpportunity[];
  nextConfirmedMode: ConfirmedMode;
}): { disabledOpportunityIds: string[]; disabledCount: number } {
  const gate = deriveReviseEligibilityLabel({ confirmedMode: params.nextConfirmedMode });
  const trustpathAllowed = gate === "Eligible for Trustpath";

  const disabledOpportunityIds = trustpathAllowed
    ? []
    : params.opportunities.filter((op) => op.trustpathEligible).map((op) => op.id);

  return {
    disabledOpportunityIds,
    disabledCount: disabledOpportunityIds.length,
  };
}
