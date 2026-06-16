export const STORY_NARRATOR_LAYER_ARTIFACT_TYPE = 'story_narrator_layer_v1' as const;

export type NarratorType =
  | 'named'
  | 'unnamed'
  | 'multi_narrator'
  | 'omniscient'
  | 'epistolary'
  | 'unknown';

export type NarratorIdentityConfidence = 'verified' | 'probable' | 'uncertain' | 'unknown';

export type NarratorIdentity = {
  display_label: string;
  canonical_name: string | null;
  name_state: 'named' | 'unnamed' | 'unknown';
  confidence: NarratorIdentityConfidence;
  evidence: string[];
  allowed_report_reference: string;
  forbidden_report_references: string[];
};

export type StoryNarratorLayerV1 = {
  artifact_type: typeof STORY_NARRATOR_LAYER_ARTIFACT_TYPE;
  artifact_version: 'v1';
  narrator_detected: boolean;
  narrator_type: NarratorType;
  narrator_count: number;
  narrators: NarratorIdentity[];
  report_guardrails: {
    narrator_name_authority_required: true;
    fallback_reference: 'the narrator' | 'the unnamed narrator' | 'the POV character';
    forbidden_theme_as_name_terms: string[];
    no_evidence_rule: string;
  };
};

export const NON_NARRATOR_IDENTITY_TERMS = [
  'cost',
  'costs',
  'expense',
  'expenses',
  'price',
  'prices',
  'vanity',
  'beauty',
  'youth',
  'money',
  'wealth',
  'status',
  'shame',
  'nation',
  'recommendation',
  'evaluation',
  'chapter',
  'scene',
  'line',
  'passage',
  'narrator',
  'author',
  'reader',
  'yes',
  'no',
  'hey',
] as const;

const NON_NARRATOR_SET = new Set<string>(NON_NARRATOR_IDENTITY_TERMS);

export function normalizeIdentityCandidate(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .trim();
}

export function isForbiddenNarratorIdentityCandidate(value: string | null | undefined): boolean {
  const clean = normalizeIdentityCandidate(value);
  if (!clean) return true;
  const normalized = clean.toLowerCase().replace(/[^a-z0-9\s'-]/g, '').trim();
  if (!normalized) return true;
  if (NON_NARRATOR_SET.has(normalized)) return true;
  if (/^(?:cost|expense|price|vanity|beauty|money|status)s?$/i.test(normalized)) return true;
  if (/^(?:yes|no|hey|ah|huh|uh|oh)$/i.test(normalized)) return true;
  if (/^(?:chapter|scene|line|paragraph|passage)\s*\d*$/i.test(normalized)) return true;
  return false;
}

export function narratorReferenceForReport(identity: NarratorIdentity | null | undefined): string {
  if (!identity) return 'the narrator';
  const name = normalizeIdentityCandidate(identity.canonical_name);
  if (identity.name_state !== 'named') return identity.allowed_report_reference || 'the unnamed narrator';
  if (identity.confidence !== 'verified' && identity.confidence !== 'probable') return 'the narrator';
  if (isForbiddenNarratorIdentityCandidate(name)) return 'the narrator';
  return name;
}

export function buildUnnamedNarratorLayer(reason = 'No explicit narrator name is supported by manuscript evidence.'): StoryNarratorLayerV1 {
  return {
    artifact_type: STORY_NARRATOR_LAYER_ARTIFACT_TYPE,
    artifact_version: 'v1',
    narrator_detected: true,
    narrator_type: 'unnamed',
    narrator_count: 1,
    narrators: [
      {
        display_label: 'Unnamed narrator',
        canonical_name: null,
        name_state: 'unnamed',
        confidence: 'unknown',
        evidence: [reason],
        allowed_report_reference: 'the unnamed narrator',
        forbidden_report_references: [...NON_NARRATOR_IDENTITY_TERMS],
      },
    ],
    report_guardrails: {
      narrator_name_authority_required: true,
      fallback_reference: 'the unnamed narrator',
      forbidden_theme_as_name_terms: [...NON_NARRATOR_IDENTITY_TERMS],
      no_evidence_rule: 'If no explicit manuscript evidence names the narrator, reports must use “the narrator” or “the unnamed narrator,” never a theme, object, cost term, greeting, yes/no token, or inferred label.',
    },
  };
}
