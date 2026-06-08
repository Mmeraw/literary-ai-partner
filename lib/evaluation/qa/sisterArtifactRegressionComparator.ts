export type SectionCheckpointId =
  | 'title_block'
  | 'one_paragraph_pitch'
  | 'one_sentence_pitch'
  | 'premise'
  | 'content_warnings'
  | 'revision_opportunity_summary'
  | 'executive_summary'
  | 'top_strengths'
  | 'top_risks'
  | 'top_recommendations'
  | 'criteria_score_grid'
  | 'criterion_rationales_and_opportunities'
  | 'confidence_explanation'
  | 'author_disclaimer';

export type SectionCheckpoint = {
  id: SectionCheckpointId;
  label: string;
  patterns: RegExp[];
};

export type ContaminationPattern = {
  code: string;
  pattern: RegExp;
};

export type SectionCheckpointResult = {
  id: SectionCheckpointId;
  label: string;
  present: boolean;
};

export type ArtifactComparisonInput = {
  artifactId: string;
  role: string;
  text: string;
};

export type ArtifactComparisonResult = {
  artifactId: string;
  role: string;
  checkpointCoverageRatio: number;
  presentCheckpoints: number;
  totalCheckpoints: number;
  checkpoints: SectionCheckpointResult[];
  contaminationCodes: string[];
};

export type BaselineDelta = {
  artifactId: string;
  role: string;
  missingAgainstBaseline: SectionCheckpointId[];
  additionalContaminationAgainstBaseline: string[];
  coverageDelta: number;
};

export type SisterArtifactRegressionReport = {
  baselineArtifactId: string;
  artifacts: ArtifactComparisonResult[];
  deltasAgainstBaseline: BaselineDelta[];
};

export const SECTION_CHECKPOINTS: SectionCheckpoint[] = [
  {
    id: 'title_block',
    label: 'Title block / score metadata',
    patterns: [/\boverall\s+score\b/i, /\bmarket\s+readiness\b/i],
  },
  {
    id: 'one_paragraph_pitch',
    label: 'One-paragraph pitch',
    patterns: [/\bone[-\s]?paragraph\s+pitch\b/i],
  },
  {
    id: 'one_sentence_pitch',
    label: 'One-sentence pitch',
    patterns: [/\bone[-\s]?sentence\s+pitch\b/i],
  },
  {
    id: 'premise',
    label: 'Premise',
    patterns: [/\bpremise\b/i],
  },
  {
    id: 'content_warnings',
    label: 'Content warnings',
    patterns: [/\bcontent\s+warnings?\b/i, /\btrigger\s+warnings?\b/i],
  },
  {
    id: 'revision_opportunity_summary',
    label: 'Revision opportunity summary',
    patterns: [/\brevision\s+opportunit(?:y|ies)\s+summary\b/i],
  },
  {
    id: 'executive_summary',
    label: 'Executive summary',
    patterns: [/\bexecutive\s+summary\b/i],
  },
  {
    id: 'top_strengths',
    label: 'Top strengths',
    patterns: [/\btop\s+strengths\b/i],
  },
  {
    id: 'top_risks',
    label: 'Top risks',
    patterns: [/\btop\s+risks\b/i],
  },
  {
    id: 'top_recommendations',
    label: 'Top recommendations',
    patterns: [/\btop\s+recommendations\b/i],
  },
  {
    id: 'criteria_score_grid',
    label: 'Criteria score grid',
    patterns: [/\bcriteria\s+score\s+grid\b/i, /\bscore\s+grid\b/i],
  },
  {
    id: 'criterion_rationales_and_opportunities',
    label: 'Criterion rationales and surfaced opportunities',
    patterns: [/\bcriterion\s+rationales?.*opportunit(?:y|ies)\b/i, /\bcriterion\s+rationales?\b/i],
  },
  {
    id: 'confidence_explanation',
    label: 'Confidence explanation',
    patterns: [/\bconfidence\s+explanation\b/i, /\bconfidence\s+level\b/i],
  },
  {
    id: 'author_disclaimer',
    label: 'Author disclaimer',
    patterns: [/\bauthor\s+disclaimer\b/i, /\bdisclaimer\b/i],
  },
];

export const CONTAMINATION_PATTERNS: ContaminationPattern[] = [
  { code: 'MALFORMED_DOUBLE_MODAL', pattern: /\b(?:would|could|should)\s+(?:would|could|should)\b/i },
  { code: 'MALFORMED_BENEFIT_FROM_ONE_BECAUSE', pattern: /\bbenefit\s+from\s+one\s+because\b/i },
  { code: 'MALFORMED_WOULD_BECAUSE', pattern: /\b(?:would|could|should)\s+because\b/i },
  { code: 'OFF_TOPIC_SAFE_INJECTION_SITES', pattern: /\bsafe\s+injection\s+sites?\b/i },
  { code: 'OFF_TOPIC_STUDIES_ARE_MIXED', pattern: /\bstudies\s+are\s+mixed\s+on\s+the\s+success\s+of\b/i },
];

export function normalizeComparisonText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function evaluateSectionCheckpoints(text: string): SectionCheckpointResult[] {
  const normalized = normalizeComparisonText(text);
  return SECTION_CHECKPOINTS.map((checkpoint) => ({
    id: checkpoint.id,
    label: checkpoint.label,
    present: checkpoint.patterns.some((pattern) => pattern.test(normalized)),
  }));
}

export function evaluateContaminationCodes(text: string): string[] {
  const normalized = normalizeComparisonText(text);
  return CONTAMINATION_PATTERNS.filter((entry) => entry.pattern.test(normalized)).map((entry) => entry.code);
}

export function compareSisterArtifacts(
  inputs: ArtifactComparisonInput[],
  baselineArtifactId: string,
): SisterArtifactRegressionReport {
  const artifacts: ArtifactComparisonResult[] = inputs.map((entry) => {
    const checkpoints = evaluateSectionCheckpoints(entry.text);
    const presentCheckpoints = checkpoints.filter((checkpoint) => checkpoint.present).length;
    const contaminationCodes = evaluateContaminationCodes(entry.text);
    return {
      artifactId: entry.artifactId,
      role: entry.role,
      checkpointCoverageRatio: checkpoints.length === 0 ? 0 : presentCheckpoints / checkpoints.length,
      presentCheckpoints,
      totalCheckpoints: checkpoints.length,
      checkpoints,
      contaminationCodes,
    };
  });

  const baseline = artifacts.find((entry) => entry.artifactId === baselineArtifactId);
  if (!baseline) {
    throw new Error(`Baseline artifact "${baselineArtifactId}" not found in comparator input.`);
  }

  const baselinePresent = new Set(
    baseline.checkpoints.filter((checkpoint) => checkpoint.present).map((checkpoint) => checkpoint.id),
  );
  const baselineContamination = new Set(baseline.contaminationCodes);

  const deltasAgainstBaseline: BaselineDelta[] = artifacts
    .filter((entry) => entry.artifactId !== baselineArtifactId)
    .map((entry) => {
      const present = new Set(
        entry.checkpoints.filter((checkpoint) => checkpoint.present).map((checkpoint) => checkpoint.id),
      );
      const missingAgainstBaseline = Array.from(baselinePresent).filter((id) => !present.has(id));
      const additionalContaminationAgainstBaseline = entry.contaminationCodes.filter(
        (code) => !baselineContamination.has(code),
      );
      return {
        artifactId: entry.artifactId,
        role: entry.role,
        missingAgainstBaseline,
        additionalContaminationAgainstBaseline,
        coverageDelta: Number((entry.checkpointCoverageRatio - baseline.checkpointCoverageRatio).toFixed(4)),
      };
    });

  return {
    baselineArtifactId,
    artifacts,
    deltasAgainstBaseline,
  };
}