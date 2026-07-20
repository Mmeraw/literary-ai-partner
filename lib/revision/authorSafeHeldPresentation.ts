export type AuthorSafeHeldPresentation = {
  holdReason: string;
  missingContext: string[];
  recoveryAction: string;
  diagnosticFamilies: Array<'evidence' | 'location' | 'context' | 'canon' | 'diagnosis' | 'candidate' | 'unknown'>;
};

type Family = AuthorSafeHeldPresentation['diagnosticFamilies'][number];

const FAMILY_COPY: Record<Family, { explanation: string; context: string; recovery: string }> = {
  evidence: {
    explanation: 'The manuscript passage needed to verify this recommendation could not be matched reliably.',
    context: 'A verifiable passage from the manuscript',
    recovery: 'Request re-analysis so RevisionGrade can locate and verify the supporting passage.',
  },
  location: {
    explanation: 'The revision location is not precise enough to make a safe change.',
    context: 'A precise manuscript location for the proposed change',
    recovery: 'Provide the relevant passage or request re-analysis to establish a precise revision location.',
  },
  context: {
    explanation: 'More surrounding manuscript context is needed before this recommendation can be applied safely.',
    context: 'The surrounding passage needed to evaluate continuity and intent',
    recovery: 'Provide the surrounding passage or request re-analysis with additional manuscript context.',
  },
  canon: {
    explanation: 'The available manuscript evidence does not establish this detail clearly enough for a safe revision.',
    context: 'Confirmation of the relevant story fact, continuity, voice, or point of view',
    recovery: 'Provide confirming manuscript context or request re-analysis after the story evidence is clarified.',
  },
  diagnosis: {
    explanation: 'The proposed revision needs stronger manuscript evidence before RevisionGrade can recommend a change.',
    context: 'Evidence that confirms the diagnosed problem in the manuscript',
    recovery: 'Request re-analysis so the diagnosis can be checked against the manuscript.',
  },
  candidate: {
    explanation: 'The suggested wording did not pass the safety and quality checks for a direct manuscript change.',
    context: 'A revision approach that preserves meaning, continuity, and authorial voice',
    recovery: 'Request re-analysis to generate a safer revision approach.',
  },
  unknown: {
    explanation: 'RevisionGrade could not verify a safe revision path for this opportunity.',
    context: 'Additional manuscript evidence needed to verify the recommendation',
    recovery: 'Request re-analysis or provide more manuscript context before applying this recommendation.',
  },
};

function familyFor(raw: string): Family {
  const reason = raw.trim().toLowerCase();
  if (/evidence|anchor|grounding|excerpt|manuscript[_ -]?match/.test(reason)) return 'evidence';
  if (/coordinate|location|target|placeholder/.test(reason)) return 'location';
  if (/context|before[_ -]?after|hydration/.test(reason)) return 'context';
  if (/canon|continuity|voice|pov|testimony|metaphor/.test(reason)) return 'canon';
  if (/diagnosis|unsupported|rationale/.test(reason)) return 'diagnosis';
  if (/candidate|quality|rewrite|prose|copy[_ -]?paste/.test(reason)) return 'candidate';
  return 'unknown';
}

export function buildAuthorSafeHeldPresentation(
  reasons: Array<string | null | undefined>,
): AuthorSafeHeldPresentation {
  const families = Array.from(new Set(reasons.map((reason) => familyFor(reason ?? '')).filter(Boolean)));
  const effectiveFamilies = families.length ? families : ['unknown' as const];
  const copy = effectiveFamilies.map((family) => FAMILY_COPY[family]);

  return {
    holdReason: copy.map((item) => item.explanation).join(' '),
    missingContext: Array.from(new Set(copy.map((item) => item.context))),
    recoveryAction: Array.from(new Set(copy.map((item) => item.recovery))).join(' '),
    diagnosticFamilies: effectiveFamilies,
  };
}

