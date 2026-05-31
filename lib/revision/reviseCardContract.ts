export const REVISION_OPERATIONS = [
  'replace_selected_passage',
  'insert_before_selected_passage',
  'insert_after_selected_passage',
  'rewrite_full_paragraph',
  'rewrite_multi_paragraph_span',
  'compress_selected_passage',
  'delete_selected_passage',
  'split_paragraph',
  'merge_paragraphs',
  'reorder_within_section',
] as const

export type RevisionOperation = typeof REVISION_OPERATIONS[number]

export type RevisionReadiness = 'ready_for_revise' | 'needs_targeting'

export type PatchApplicationStatus =
  | 'not_applied'
  | 'previewed'
  | 'applied'
  | 'failed'
  | 'conflict_detected'

export type RevisionOptionRole =
  | 'recommended_repair'
  | 'rhythm_variant'
  | 'bolder_rendering_shift'

export type ReviseCardValidationInput = {
  sourceText: string | null | undefined
  sourceLocationLabel: string | null | undefined
  revisionOperation: RevisionOperation | null | undefined
  candidateTexts: Array<string | null | undefined>
}

export type ReviseCardValidationResult = {
  readiness: RevisionReadiness
  reason: string | null
}

export const operationLabels: Record<RevisionOperation, string> = {
  replace_selected_passage: 'Suggested replacement',
  insert_before_selected_passage: 'Suggested insertion before passage',
  insert_after_selected_passage: 'Suggested insertion after passage',
  rewrite_full_paragraph: 'Suggested paragraph rewrite',
  rewrite_multi_paragraph_span: 'Suggested multi-paragraph rewrite',
  compress_selected_passage: 'Suggested compressed version',
  delete_selected_passage: 'Suggested deletion',
  split_paragraph: 'Suggested split',
  merge_paragraphs: 'Suggested merged passage',
  reorder_within_section: 'Suggested reordered sequence',
}

export const customOperationLabels: Record<RevisionOperation, string> = {
  replace_selected_passage: 'Write your custom replacement',
  insert_before_selected_passage: 'Write your custom insertion before this passage',
  insert_after_selected_passage: 'Write your custom insertion after this passage',
  rewrite_full_paragraph: 'Write your custom paragraph rewrite',
  rewrite_multi_paragraph_span: 'Write your custom multi-paragraph rewrite',
  compress_selected_passage: 'Write your custom compressed version',
  delete_selected_passage: 'Write your custom deletion note',
  split_paragraph: 'Write your custom split version',
  merge_paragraphs: 'Write your custom merged passage',
  reorder_within_section: 'Write your custom reordered sequence',
}

const FORBIDDEN_META_SUGGESTIONS = [
  'review this opportunity',
  'apply the same repair goal',
  'choose the least disruptive repair',
  'preserves author voice',
  'preserve author voice',
  'stronger emphasis, image, or beat structure',
  'add the smallest connective beat',
  're-sequence or deepen the affected beat',
  'default repair path',
  'primary repair path from the evaluation',
  'higher-leverage option when local polish is not enough',
  'in the paragraph containing',
  'replace one clause',
  'replace one rhyme-heavy clause',
  'replace this',
  'clarify',
  'strengthen',
  'repair this',
  'fix this',
  'recommended repair path',
  'primary repair path',
  'evaluation_result',
  'criteria.recommendations',
  'prosecontrol',
  'narrativedrive',
  'recommendation',
]

const MISSING_SOURCE_MARKERS = [
  'no excerpt available',
  'location pending',
  'manuscript-wide pattern',
  'available in diagnostic details',
]

function normalize(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function tokenSet(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean),
  )
}

function overlapRatio(a: string, b: string): number {
  const left = tokenSet(a)
  const right = tokenSet(b)
  if (left.size === 0 || right.size === 0) return 0
  let overlap = 0
  for (const token of left) {
    if (right.has(token)) overlap += 1
  }
  return overlap / Math.max(left.size, right.size)
}

function hasInternalTokenLeak(value: string): boolean {
  const clean = normalize(value)
  if (!clean) return false

  if (/\b[A-Z]{3,}:[a-z_]+\b/.test(clean)) return true
  if (/\b(?:evaluation_result|criteria\.recommendations|prosecontrol|narrativedrive|provenance)\b/i.test(clean)) {
    return true
  }

  return false
}

export function hasForbiddenMetaSuggestion(value: string | null | undefined): boolean {
  const clean = normalize(value).toLowerCase()
  if (!clean) return false
  return FORBIDDEN_META_SUGGESTIONS.some((phrase) => clean.includes(phrase))
}

export function isMissingSourceMarker(value: string | null | undefined): boolean {
  const clean = normalize(value).toLowerCase()
  if (!clean) return true
  return MISSING_SOURCE_MARKERS.some((marker) => clean.includes(marker))
}

export function candidateTextIsCopyPasteReady(value: string | null | undefined): boolean {
  const clean = normalize(value)
  if (!clean) return false
  if (hasForbiddenMetaSuggestion(clean)) return false
  if (hasInternalTokenLeak(clean)) return false

  // Copy-paste prose must have at least enough substance to be a manuscript patch.
  // This intentionally allows short insertions, but blocks one-word placeholders.
  return clean.split(/\s+/).length >= 5
}

export function validateReviseCardContract(input: ReviseCardValidationInput): ReviseCardValidationResult {
  if (!input.revisionOperation) {
    return { readiness: 'needs_targeting', reason: 'Missing revision operation.' }
  }

  if (!normalize(input.sourceLocationLabel) || isMissingSourceMarker(input.sourceLocationLabel)) {
    return { readiness: 'needs_targeting', reason: 'Missing exact source location.' }
  }

  if (!normalize(input.sourceText) || isMissingSourceMarker(input.sourceText)) {
    return { readiness: 'needs_targeting', reason: 'Missing exact source passage.' }
  }

  if (input.candidateTexts.length < 3) {
    return { readiness: 'needs_targeting', reason: 'Missing A/B/C candidate patches.' }
  }

  const invalidIndex = input.candidateTexts.findIndex((text) => !candidateTextIsCopyPasteReady(text))
  if (invalidIndex !== -1) {
    return { readiness: 'needs_targeting', reason: `Candidate ${String.fromCharCode(65 + invalidIndex)} is not copy-paste ready.` }
  }

  const normalizedCandidates = input.candidateTexts
    .slice(0, 3)
    .map((text) => normalize(text).toLowerCase())

  if (new Set(normalizedCandidates).size < 3) {
    return { readiness: 'needs_targeting', reason: 'Candidate options are not materially distinct.' }
  }

  const [a, b, c] = normalizedCandidates
  if (overlapRatio(a, b) >= 0.9 || overlapRatio(a, c) >= 0.9 || overlapRatio(b, c) >= 0.9) {
    return { readiness: 'needs_targeting', reason: 'Candidate options are not materially distinct.' }
  }

  return { readiness: 'ready_for_revise', reason: null }
}

export function inferRevisionOperation(input: {
  scope?: string | null
  mode?: string | null
  fixDirection?: string | null
  recommendation?: string | null
}): RevisionOperation {
  const scope = normalize(input.scope).toLowerCase()
  const haystack = [input.fixDirection, input.recommendation, input.mode, input.scope]
    .map(normalize)
    .join(' ')
    .toLowerCase()

  if (/\b(insert|add|include|introduce)\b/.test(haystack) && /\bbefore\b/.test(haystack)) return 'insert_before_selected_passage'
  if (/\b(insert|add|include|introduce)\b/.test(haystack)) return 'insert_after_selected_passage'
  if (/\b(compress|condense|trim|tighten|shorten)\b/.test(haystack)) return 'compress_selected_passage'
  if (/\b(delete|remove|cut)\b/.test(haystack)) return 'delete_selected_passage'
  if (/\bsplit\b/.test(haystack)) return 'split_paragraph'
  if (/\bmerge\b/.test(haystack)) return 'merge_paragraphs'
  if (/\b(reorder|re-sequence|resequence)\b/.test(haystack)) return 'reorder_within_section'

  if (scope === 'line' || scope === 'passage') return 'replace_selected_passage'
  if (scope === 'scene' || scope === 'chapter' || scope === 'structural' || scope === 'manuscript') return 'rewrite_multi_paragraph_span'

  return 'replace_selected_passage'
}

export function operationRequiresStructuralPreview(operation: RevisionOperation): boolean {
  return [
    'rewrite_multi_paragraph_span',
    'delete_selected_passage',
    'merge_paragraphs',
    'reorder_within_section',
  ].includes(operation)
}
