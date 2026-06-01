type StoryLayerContent = {
  layer_completion_summary?: {
    total_layers: number;
    populated_layers: number;
    empty_layers?: string[];
    degraded_layers?: string[];
  } | null;
  layers?: Record<string, Record<string, unknown>>;
};

type LedgerQualityReportContent = {
  quality_report?: {
    gate_ready_status?:
      | 'reviewable'
      | 'blocked'
      | 'blocked_retryable_technical'
      | 'blocked_content_hard_fail'
      | 'repair_required';
    grouped_warning_summary?: Record<string, string[]>;
    blocking_reasons?: string[];
  } | null;
} | null;

export type ReviewGateSemanticResult = {
  ok: boolean;
  code: 'REVIEW_GATE_SEMANTIC_BLOCKED' | null;
  reasons: string[];
};

function includesChunkLabel(value: unknown): boolean {
  if (typeof value === 'string') {
    return /\bchunk\b/i.test(value);
  }

  if (Array.isArray(value)) {
    return value.some((entry) => includesChunkLabel(entry));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).some(([key, entry]) => {
      if (key.toLowerCase().includes('internal') || key.toLowerCase().includes('debug')) {
        return false;
      }
      return includesChunkLabel(entry);
    });
  }

  return false;
}

export function evaluateReviewGateSemanticGate(input: {
  storyLayerContent: StoryLayerContent | null;
  qualityReportContent: LedgerQualityReportContent;
}): ReviewGateSemanticResult {
  const reasons: string[] = [];
  const qualityReport = input.qualityReportContent?.quality_report ?? null;
  const completion = input.storyLayerContent?.layer_completion_summary ?? null;
  const layers = input.storyLayerContent?.layers ?? null;

  if (!qualityReport) {
    reasons.push('Missing ledger_quality_report_v1 content.');
  } else {
    if (qualityReport.gate_ready_status !== 'reviewable') {
      reasons.push(
        `Ledger quality gate is not reviewable (gate_ready_status=${qualityReport.gate_ready_status ?? 'unknown'}).`,
      );
    }

    if ((qualityReport.blocking_reasons ?? []).length > 0) {
      reasons.push(...(qualityReport.blocking_reasons ?? []).map((r) => `Blocking reason: ${r}`));
    }

    const warningSummary = qualityReport.grouped_warning_summary ?? {};
    const warningLayers = Object.keys(warningSummary).filter(
      (layerKey) => (warningSummary[layerKey] ?? []).length > 0,
    );
    if (warningLayers.length > 0) {
      reasons.push(
        `Layer warning summary is non-empty for: ${warningLayers.join(', ')}.`,
      );
    }
  }

  if (!completion) {
    reasons.push('Missing layer_completion_summary in pass1a_story_layer_v1.');
  } else {
    if (completion.populated_layers !== completion.total_layers) {
      reasons.push(
        `Layer completion mismatch (${completion.populated_layers}/${completion.total_layers}).`,
      );
    }
    if ((completion.empty_layers ?? []).length > 0) {
      reasons.push(`Empty layers present: ${(completion.empty_layers ?? []).join(', ')}.`);
    }
    if ((completion.degraded_layers ?? []).length > 0) {
      reasons.push(`Degraded layers present: ${(completion.degraded_layers ?? []).join(', ')}.`);
    }
  }

  if (layers && includesChunkLabel(layers)) {
    reasons.push('Author-facing story layer payload contains forbidden chunk labels.');
  }

  if (reasons.length > 0) {
    return {
      ok: false,
      code: 'REVIEW_GATE_SEMANTIC_BLOCKED',
      reasons,
    };
  }

  return { ok: true, code: null, reasons: [] };
}
